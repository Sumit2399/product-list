const express = require("express");
const { container } = require("./db");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// Add a new product
app.post("/products", async (req, res) => {
    try {
        const { name, description, price, category } = req.body;
        const { resource } = await container.items.create({ id: Date.now().toString(), name, description, price, category });
        res.status(201).send(resource);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// List all products
app.get("/products", async (req, res) => {
    try {
        const { resources } = await container.items.readAll().fetchAll();
        res.json(resources);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
