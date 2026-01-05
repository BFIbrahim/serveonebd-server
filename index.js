const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config()

const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.xgglsra.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const db = client.db('database')
        const requestCollection = db.collection('requests')

        app.get('/requests', async (req, res) => {
            const requests = await requestCollection.find().toArray()
            res.send(requests)
        })

        app.get('/pending-requests', async (req, res) => {
            try {
                const requests = await requestCollection.find({ status: "pending" }).toArray()

                res.send(requests)
            } catch (error) {
                console.log({ message: error.message })
            }
        })

        app.get('/requests/email', async (req, res) => {
            try {
                const email = req.query.email

                if (!email) {
                    res.send('Email is required')
                }

                const result = await requestCollection.find({ email: email }).sort({ createdAt: - 1 }).toArray()

                res.send(result)
            } catch (error) {
                console.log({ message: error.message })
            }
        })

        app.post('/requests', async (req, res) => {
            try {
                const newRequest = req.body
                newRequest.createdAt = new Date()
                newRequest.status = 'pending'

                const result = await requestCollection.insertOne(newRequest)
                res.status(201).send(result)
            } catch (error) {
                console.log('Error inserting percel', error)
                res.status(500).send('Failed to create new request')
            }
        })

        const { ObjectId } = require("mongodb");

        app.patch('/requests/:id/status', async (req, res) => {
            try {
                const { id } = req.params;
                const { status } = req.body;

                // Validate status
                if (!status || !["approved", "rejected"].includes(status)) {
                    return res.status(400).send({ message: "Status must be 'approved' or 'rejected'" });
                }

                const result = await requestCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).send({ message: "Request not found" });
                }

                res.status(200).send({
                    success: true,
                    message: `Request status updated to ${status}`,
                });
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: error.message });
            }
        });

        app.delete('/requests/:id', async (req, res) => {
            try {
                const { id } = req.params

                const result = await requestCollection.deleteOne({
                    _id: new ObjectId(id)
                })

                if (result.deletedCount === 0) {
                    return res.status(404).send({ message: "Request not found" });
                }

                res.status(200).send({
                    success: true,
                    message: "Request deleted successfully",
                });

            } catch (error) {
                res.status(500).send({ message: error.message });
            }
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Server Properly Running')
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})