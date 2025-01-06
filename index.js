const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.czfhh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    const bookCollection = client.db("bookDB").collection("books");
    const borrowedBookCollection = client
      .db("bookDB")
      .collection("borrowedBooks");

    // JWT authentication related apis----->

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    });

    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    });
    // Books related apis-------->

    app.post("/allBooks", async (req, res) => {
      const books = req.body;
      const result = await bookCollection.insertOne(books);
      res.send(result);
    });

    app.get("/allBooks", verifyToken, async (req, res) => {
      const cursor = bookCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/books/:category", async (req, res) => {
      const category = req.params.category;
      const query = { category: category };
      const cursor = bookCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/book/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookCollection.findOne(query);
      res.send(result);
    });

    // Update quantity of book---->

    app.put("/allBooks", async (req, res) => {
      const { id } = req.body;
      const book = await bookCollection.findOne({ _id: new ObjectId(id) });
      const newQuantity = (parseInt(book.quantity) - 1).toString();
      const result = await bookCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            quantity: newQuantity,
            isBorrowed: true,
          },
        }
      );
      res.send(result);
    });

    app.put("/allBooks2", async (req, res) => {
      const { id } = req.body;
      const book = await bookCollection.findOne({ _id: new ObjectId(id) });

      const newQuantity = (parseInt(book.quantity) + 1).toString();
      const result = await bookCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            quantity: newQuantity,
            isBorrowed: false,
          },
        }
      );
      res.send(result);
    });

    // update book information------>

    app.patch("/updateBook/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedBook = req.body;
      const book = {
        $set: {
          book_title: updatedBook.book_title,
          cover_photo: updatedBook.cover_photo,
          author_name: updatedBook.author_name,
          category: updatedBook.category,
          rating: updatedBook.rating,
        },
      };
      const result = await bookCollection.updateOne(filter, book, options);
      res.send(result);
    });

    app.get("/availableBooks", async (req, res) => {
      const filter = bookCollection.find({
        $expr: { $gt: [{ $toInt: "$quantity" }, 0] },
      });
      const availableBooks = await filter.toArray();
      res.send(availableBooks);
    });

    // borrow related apis-------->

    app.post("/borrowedBooks", async (req, res) => {
      const borrowedBooks = req.body;
      const result = await borrowedBookCollection.insertOne(borrowedBooks);
      res.send(result);
    });

    app.get("/borrowedBooks", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await borrowedBookCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/borrowedBooks/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await borrowedBookCollection.findOne(query);
      res.send(result);
    });

    app.delete("/borrowedBooks/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await borrowedBookCollection.deleteOne(query);
      res.send(result);
    });
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
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
  res.send("Books are ready!!!");
});

app.listen(port, () => {
  console.log("Server running successful");
});
