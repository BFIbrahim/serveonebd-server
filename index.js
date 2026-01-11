const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");

dotenv.config()

const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const serviceAccount = require("./firebase-admin-key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


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
        const usersCollection = db.collection('users')
        const requestCollection = db.collection('requests')
        const volunteersCollection = db.collection('volunteers')
        const campaignsCollection = db.collection('campaigns')

        const veriFyLogin = async (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: 'Unauthorized Access' })
            }

            const token = authHeader.split(' ')[1]
            if (!token) {
                return res.status(401).send({ message: 'Unauthorized Access' })
            }

            try {
                const decoded = await admin.auth().verifyIdToken(token)
                req.decoded = decoded
                next()

            } catch (error) {
                return res.status(403).send({ message: 'Forbidded Access' })
            }


        }

        app.post('/users', async (req, res) => {
            const { email } = req.body.email
            const existsUser = await usersCollection.findOne({ email })
            if (existsUser) {
                return res.status(200).send({ message: 'User already exists' })
            }

            const user = req.body
            const result = await usersCollection.insertOne(user)

            res.status(200).send(result)
        })

        app.get("/users/role", async (req, res) => {
            const email = req.query.email;

            if (!email) {
                return res.status(400).send({ message: "Email is required" });
            }

            const user = await usersCollection.findOne({ email });

            if (!user) {
                return res.send({ role: "user" });
            }

            res.send({ role: user.role });
        });

        app.patch("/users/:email/role", async (req, res) => {
            try {
                const { email } = req.params;
                const { role } = req.body;

                if (!role) {
                    return res.status(400).send({ message: "Role is required" });
                }

                const result = await usersCollection.updateOne(
                    { email },
                    { $set: { role } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).send({ message: "User not found" });
                }

                res.status(200).send({
                    success: true,
                    message: `User role updated to ${role}`,
                });
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: error.message });
            }
        });

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

        app.get('/requests/email', veriFyLogin, async (req, res) => {

            try {
                const email = req.query.email

                console.log('decoded', req.decoded)

                if (req.decoded.email !== email) {
                    res.status(403).send({ message: 'Forbidden Access' })
                }

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

                const allowedStatuses = ["approved", "rejected", "matched", "completed"];
                if (!status || !allowedStatuses.includes(status)) {
                    return res.status(400).send({
                        message: `Status must be one of: ${allowedStatuses.join(", ")}`
                    });
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

        app.get('/requests/approved', async (req, res) => {
            try {
                const approvedRequests = await requestCollection
                    .find({ status: "approved" })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).send(approvedRequests);
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

        app.post('/volunteers', async (req, res) => {
            try {
                const volunteer = req.body
                const email = req.body.email

                const existsApplication = await volunteersCollection.findOne({ email: email })

                if (existsApplication) {
                    return res.status(409).send({ message: 'Request Already Submitted' });
                }

                const result = await volunteersCollection.insertOne(volunteer)
                res.send(result)
            } catch (error) {
                res.send({ message: 'failed to send request' })
            }
        })

        app.get('/volunteers/pending', async (req, res) => {
            try {
                const pendingVolunteers = await volunteersCollection
                    .find({ status: "pending" })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).send(pendingVolunteers);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: error.message });
            }
        });

        app.get('/volunteers/approved', async (req, res) => {
            try {
                const activeVolunteers = await volunteersCollection
                    .find({ status: "approved" })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).send(activeVolunteers);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: error.message });
            }
        });

        app.patch('/volunteers/:id/status', async (req, res) => {
            try {
                const { id } = req.params;
                const { status, email } = req.body;

                const allowedStatus = ["approved", "rejected"];

                if (!status || !allowedStatus.includes(status)) {
                    return res.status(400).send({
                        message: `Status must be one of: ${allowedStatus.join(", ")}`
                    });
                }

                const volunteerResult = await volunteersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                );

                if (volunteerResult.matchedCount === 0) {
                    return res.status(404).send({ message: "Volunteer not found" });
                }

                const roleMap = {
                    approved: "volunteer",
                    rejected: "user",
                };

                const userRole = roleMap[status];

                const userResult = await usersCollection.updateOne(
                    { email },
                    { $set: { role: userRole } }
                );

                res.status(200).send({
                    success: true,
                    message: `Volunteer has been ${status}`,
                    userRoleUpdated: userResult.modifiedCount > 0,
                });

            } catch (error) {
                console.error(error);
                res.status(500).send({ message: error.message });
            }
        });


        app.delete('/volunteers/:id', async (req, res) => {
            try {
                const { id } = req.params;

                const result = await volunteersCollection.deleteOne(
                    { _id: new ObjectId(id) }
                );

                if (result.deletedCount === 0) {
                    return res.status(404).send({ message: "Volunteer not found" });
                }

                res.status(200).send({
                    success: true,
                    message: "Volunteer request removed successfully",
                });
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: error.message });
            }
        });

        app.post('/campaigns', async (req, res) => {
            try {
                const campiagn = req.body

                const result = await campaignsCollection.insertOne(campiagn)
                res.status(200).send(result)
            } catch (error) {
                res.status(500).send('Failed to add new campaign')
            }
        })

        app.get("/campaigns", async (req, res) => {
            try {
                const { status } = req.query;

                const query = {};
                if (status) {
                    query.status = status;
                }

                const campaigns = await campaignsCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.send(campaigns);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to fetch campaigns",
                    error: error.message,
                });
            }
        });

        app.patch("/campaigns/:id/status", async (req, res) => {
            try {
                const { id } = req.params;
                const { status } = req.body;

                const allowedStatus = ["approved", "rejected"];
                if (!allowedStatus.includes(status)) {
                    return res.status(400).send({
                        message: "Invalid status value",
                    });
                }

                const result = await campaignsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            status,
                            updatedAt: new Date(),
                        },
                    }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).send({
                        message: "Campaign not found",
                    });
                }

                res.send({
                    success: true,
                    message: `Campaign ${status} successfully`,
                });
            } catch (error) {
                res.status(500).send({
                    message: "Failed to update campaign status",
                    error: error.message,
                });
            }
        });






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