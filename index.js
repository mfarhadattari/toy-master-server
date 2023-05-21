/* -------------- import--------------- */
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 5000;

/* ---------- middleware----------- */
app.use(cors());
app.use(express.json());

/* -------------------------------------------------------------
  !------------------| JWT TOKEN VERIFIER | -------------------
------------------------------------------------------------------ */
const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized Access" });
  }

  const token = authorization.split(" ")[1];
  if (token === "null") {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized Access" });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res
        .status(403)
        .send({ error: true, message: "User Token Expired" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rxhaoz0.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();

    /* ---------------------------------------------
      !--------------------| COLLECTION | --------------
  ------------------------------------------------------- */
    const toysCollection = client.db("toyMaster").collection("toys");
    const categoriesCollection = client
      .db("toyMaster")
      .collection("categories");

    /* ------------------------------------------------------
    !------------------| TOYS NUMBERS |-----------------------
    ------------------------------------------------------------ */
    app.get("/total-toys", async (req, res) => {
      const result = await toysCollection.estimatedDocumentCount();
      res.send({ totalToys: result });
    });

    /* -----------------------------------------------------------
    !---------------------| GET TOYS NUMBER BY CATEGORY | --------
    -------------------------------------------------------------- */
    app.get("/category-toys/:category", async (req, res) => {
      const category = req.params.category;
      const filter = { category: category };
      const result = await toysCollection.countDocuments(filter);
      res.send({ total: result });
    });

    /* -------------------------------------------------------------
      ! --------------------| GET CATEGORIES |---------------------
      ------------------------------------------------------------ */
    app.get("/categories", async (req, res) => {
      const result = await categoriesCollection.find().toArray();
      res.send(result);
    });

    /* -------------------------------------------------------------
      !------------------| GIT TOYS  |-------------------
    ----------------------------------------------------------------- */
    app.get("/toys", async (req, res) => {
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 20;
      const skip = page * limit;
      const result = await toysCollection
        .find()
        .limit(limit)
        .skip(skip)
        .toArray();
      res.send(result);
    });

    /* ------------------------------------------------------------------
    ! -------------------| GET TOYS BY CATEGORY | ---------------
    --------------------------------------------------------------------- */
    app.get("/toys-by-category/:category", async (req, res) => {
      const category = req.params.category;
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 6;
      const skip = page * limit;
      const query = { category: category };
      const result = await toysCollection
        .find(query)
        .limit(limit)
        .skip(skip)
        .toArray();
      res.send(result);
    });

    /* -------------------------------------------------------
    ! -------------------| ADD A TOY | -------------------------
    ----------------------------------------------------------- */
    app.post("/add-toy", async (req, res) => {
      const toyData = req.body;
      const result = await toysCollection.insertOne(toyData);
      res.send(result);
    });

    /* -------------------------------------------------------------------
      !---------- | GET MY TOYS BY NONE SORTING AND SORTING | -----------
      ------------------------------------------------------------------ */
    app.get("/my-toys", verifyToken, async (req, res) => {
      const email = req.query.email;
      const sortBy = req.query.sortBy || "None";

      const decoded = req.decoded;
      if (!decoded.email === email) {
        return res
          .status(403)
          .send({ error: true, message: "Access Forbidden" });
      }

      const filter = { email: email };
      if (sortBy == "Descending (price)") {
        const result = await toysCollection
          .find(filter)
          .sort({ price: -1 })
          .toArray();
        res.send(result);
      } else if (sortBy === "Ascending (price)") {
        const result = await toysCollection
          .find(filter)
          .sort({ price: 1 })
          .toArray();
        res.send(result);
      } else {
        const result = await toysCollection.find(filter).toArray();
        res.send(result);
      }
    });

    /* -----------------------------------------------------------------------------
        !---------------------- | REMOVE A TOY | ---------------------------- 
        --------------------------------------------------------------------------- */
    app.delete("/remove-toy/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await toysCollection.deleteOne(query);
      res.send(result);
    });

    /* ------------------------------------------------------------------------------
      !---------------------------| UPDATE A TOY | -----------------------------
    -------------------------------------------------------------------------------- */
    app.patch("/update-toy/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const query = { _id: new ObjectId(id) };

      const updateInfo = {
        $set: {
          price: data.price,
          quantity: data.quantity,
          rating: data.rating,
          details: data.details,
        },
      };
      const result = await toysCollection.updateOne(query, updateInfo);
      res.send(result);
    });

    /* ------------------------------------------------------------------------
      ! ------------------- | TOY DETAILS | -------------------------------
    -------------------------------------------------------------------------- */
    app.get("/toy-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await toysCollection.findOne(query);
      res.send(result);
    });

    /* ------------------------------------------------------------------------
      !-----------------| SEARCH TOY BY NAME OR  KEYWORD OR LETTER | ----------- 
    ------------------------------------------------------------------------*/
    app.get("/search-toy", async (req, res) => {
      const search = req.query.search;
      const regexPattern = new RegExp(search, "i");
      const query = { name: { $regex: regexPattern } };
      const result = await toysCollection.find(query).toArray();
      res.send(result);
    });

    /* -------------------------------------------------------
      !--------------------- JWT TOKEN GENERATOR ------------------!
      ------------------------------------------------------------ */
    app.post("/generate-jwt-token", (req, res) => {
      const data = req.body;
      const token = jwt.sign(data, process.env.JWT_SECRET_KEY, {
        algorithm: "HS384",
        expiresIn: `1h`,
      });
      res.send({ token: token });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("TOY MASTER SERVER IS RUNNING...");
});

app.listen(port, () => {
  console.log(`TOY MASTER RUNNING ON ${port}`);
});
