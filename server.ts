/* global process */
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { CosmosClient } from "@azure/cosmos";
import { AppData } from "./types";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 8080;

  app.use(express.json({ limit: '10mb' }));

  // Helper for lazy Cosmos DB initialization
  const getCosmosClient = (connectionString?: string) => {
    const conn = connectionString || process.env.AZURE_COSMOS_CONNECTION_STRING;
    if (!conn) {
      throw new Error("Azure Cosmos DB connection string is missing.");
    }
    return new CosmosClient(conn);
  };

  
  // API Routes
  app.post("/api/cosmos/archive", async (req, res) => {
    const { connectionString } = req.body as { connectionString?: string };
    
    try {
      if (!connectionString && !process.env.AZURE_COSMOS_CONNECTION_STRING) {
        return res.status(400).json({ error: "Cosmos DB not configured" });
      }

      const client = getCosmosClient(connectionString);
      const databaseId = "FinancialHub";
      const containerId = "AppData";
      
      const { database } = await client.databases.createIfNotExists({ id: databaseId });
      const { container } = await database.containers.createIfNotExists({ id: containerId });

      const docId = "app_state";
      
      // Load current state
      const { resource: currentState } = await container.item(docId, docId).read();
      
      if (!currentState) {
        return res.status(404).json({ error: "No data found to archive" });
      }

      // Create an archive document
      const archiveId = `archive_app_state_${new Date().getTime()}`;
      await container.items.create({
        ...currentState,
        id: archiveId,
        archived_at: new Date().toISOString()
      });

      // After archiving, we could either leave the main doc or clear it. 
      // The user said "Archive Cosmos app data", usually implying the main one gets cleared or moved.
      // Let's delete the main document to "wipe" the active state as requested by the context of "Wipe local".
       await container.item(docId, docId).delete();

      res.json({ success: true, archiveId });
    } catch (error) {
      const err = error as Error;
      console.error("Cosmos DB Archive Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/cosmos/config", (req, res) => {
    res.json({
      hasServerConnectionString: !!process.env.AZURE_COSMOS_CONNECTION_STRING
    });
  });

  app.post("/api/cosmos/sync", async (req, res) => {
    const { connectionString, data } = req.body as { connectionString?: string; data: AppData };
    
    try {
      if (!connectionString && !process.env.AZURE_COSMOS_CONNECTION_STRING) {
        return res.status(400).json({ error: "Connection string required" });
      }

      const client = getCosmosClient(connectionString);
      const databaseId = "FinancialHub";
      const containerId = "AppData";

      // Ensure database and container exist
      const { database } = await client.databases.createIfNotExists({ id: databaseId });
      const { container } = await database.containers.createIfNotExists({
        id: containerId,
        partitionKey: { paths: ["/id"] }
      });

      const docId = "app_state";
      
      await container.items.upsert({
        id: docId,
        ...data,
        updatedAt: new Date().toISOString()
      });

      console.log(`Synced document ${docId} to Cosmos DB`);
      res.json({ success: true, message: "Synced successfully with Cosmos DB" });
    } catch (error) {
      const err = error as Error;
      console.error("Cosmos DB Sync Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/cosmos/load", async (req, res) => {
    const connectionString = req.query.connectionString as string;
    
    try {
      if (!connectionString && !process.env.AZURE_COSMOS_CONNECTION_STRING) {
        // Not configured, return null data instead of error to allow app to proceed with local data
        return res.json({ data: null, configured: false });
      }

      const client = getCosmosClient(connectionString);
      const databaseId = "FinancialHub";
      const containerId = "AppData";

      const { database } = await client.databases.createIfNotExists({ id: databaseId });
      const { container } = await database.containers.createIfNotExists({
        id: containerId,
        partitionKey: { paths: ["/id"] }
      });

      const docId = "app_state";
      console.log(`Attempting to load document: ${docId} from ${databaseId}/${containerId}`);
      
      // Use a query instead of item().read() to be more robust against partition key configuration issues
      const { resources } = await container.items.query({
        query: "SELECT * FROM c WHERE c.id = @id",
        parameters: [{ name: "@id", value: docId }]
      }).fetchAll();

      const resource = resources.length > 0 ? resources[0] : null;

      if (resource) {
        console.log(`Successfully loaded document ${docId}. UpdatedAt: ${resource.updatedAt}`);
        // Clean up internal Cosmos fields before sending to client
        const { _rid, _self, _etag, _attachments, _ts, ...cleanResource } = resource;
        res.json({ data: cleanResource, configured: true });
        console.log(`Sent clean resource. RID: ${_rid}, Self: ${_self}, Etag: ${_etag}, Attachments: ${_attachments}, TS: ${_ts}`);
      } else {
        console.log(`No document found with ID ${docId} in ${databaseId}/${containerId}`);
        res.json({ data: null, configured: true });
      }
    } catch (error) {
      const err = error as Error;
      console.error("Cosmos DB Load Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
