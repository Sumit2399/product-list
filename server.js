const express = require("express");
const { container } = require("./db");
const cors = require("cors");
const multer = require("multer");
const { BlobServiceClient } = require("@azure/storage-blob");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Azure Blob Storage setup
const AZURE_STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT;
const AZURE_STORAGE_KEY = process.env.AZURE_STORAGE_KEY;
const AZURE_CONTAINER_NAME = process.env.AZURE_CONTAINER_NAME;

if (!AZURE_STORAGE_ACCOUNT || !AZURE_STORAGE_KEY || !AZURE_CONTAINER_NAME) {
    throw new Error("Azure Storage account details are missing in environment variables.");
}

const blobServiceClient = BlobServiceClient.fromConnectionString(
    `DefaultEndpointsProtocol=https;AccountName=${AZURE_STORAGE_ACCOUNT};AccountKey=${AZURE_STORAGE_KEY};EndpointSuffix=core.windows.net`
);
const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);

// Ensure container exists
(async () => {
    try {
        await containerClient.createIfNotExists();
        console.log("Azure Blob Storage container is ready.");
    } catch (err) {
        console.error("Failed to initialize Azure Blob Storage container:", err);
    }
})();

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed."), false);
        }
    }
});

// Add a new product with image upload
app.post("/products", upload.single("image"), async (req, res) => {
    try {
        const { name, description, price, category } = req.body;

        // Validate required fields
        if (!name || !price || !category) {
            return res.status(400).json({ error: "Name, price, and category are required." });
        }

        // Validate price is a number
        if (isNaN(parseFloat(price))) {
            return res.status(400).json({ error: "Price must be a valid number." });
        }

        let imageUrl = "";

        // Upload image to Azure Blob Storage if provided
        if (req.file) {
            const blobName = `${Date.now()}-${req.file.originalname}`;
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            await blockBlobClient.uploadData(req.file.buffer, {
                blobHTTPHeaders: { blobContentType: req.file.mimetype }
            });
            imageUrl = blockBlobClient.url;
        }

        // Save product to database
        const { resource } = await container.items.create({
            id: Date.now().toString(),
            name,
            description: description || "", // Optional field
            price: parseFloat(price),
            category,
            imageUrl
        });

        res.status(201).json(resource);
    } catch (err) {
        console.error("Error adding product:", err);
        res.status(500).json({ error: "Failed to add product. Please try again later." });
    }
});

// List all products
app.get("/products", async (req, res) => {
    try {
        const { resources } = await container.items.readAll().fetchAll();
        res.json(resources);
    } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).json({ error: "Failed to fetch products. Please try again later." });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
