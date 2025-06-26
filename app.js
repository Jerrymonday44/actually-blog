import express from "express";
import bodyParser from "body-parser";
import pkg from 'pg';
import multer from "multer";
import fs from "fs";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

const app = express();
const port = process.env.PORT || 2754;

// Database connection using environment variables
const { Pool } = pkg;

// Determine if the environment is production
const isProduction = process.env.NODE_ENV === 'production';

// Create the pool configuration dynamically based on the environment
const pool = new Pool(
    isProduction
        ? {
              // Production environment (e.g., Heroku)
              connectionString: process.env.DATABASE_URL,
              ssl: {
                  rejectUnauthorized: false, // Required for Heroku
              },
          }
        : {
              // Development environment (local)
              user: process.env.DB_USER,
              host: process.env.DB_HOST,
              database: process.env.DB_NAME,
              password: process.env.DB_PASSWORD,
              port: process.env.DB_PORT,
          }
);

// Export the pool for use in other modules
export default pool;

// Middleware setup
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads")); // Be cautious about exposing this publicly
app.use(express.static("public")); // Serve static files
app.set("view engine", "ejs"); // Set EJS as the templating engine

// Ensure 'uploads' folder exists
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// Multer configuration
const storage = multer.diskStorage({
  destination: "uploads",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'image/svg+xml', 'image/bmp', 'image/tiff', 'image/x-icon',
      'image/avif', 'image/heif',
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
      'video/x-msvideo', 'video/x-ms-wmv', 'video/x-matroska',
      'video/x-flv', 'video/3gpp', 'video/mp2t'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video formats are allowed"));
    }
  },
});

const multiUpload = upload.array("files", 10); // Maximum 10 files

// Error handler for async routes
const handleAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Utility: Parse BYTEA image data
const parseImageData = (image) => {
  try {
    const parsedBuffer = JSON.parse(image.toString("utf-8"));
    if (parsedBuffer.type === "Buffer" && Array.isArray(parsedBuffer.data)) {
      const innerJSON = Buffer.from(parsedBuffer.data).toString("utf-8");
      return JSON.parse(innerJSON);
    }
  } catch (error) {
    console.error("Error parsing image data:", error);
  }
  return [];
};

// Nodemailer setup with environment variables
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Replace with your email
    pass: process.env.EMAIL_PASSWORD, // Replace with your app password
  },
});

// Send email route
app.post(
  "/send-email",
  handleAsync(async (req, res) => {
    const { firstname, lastname, email, phone, message } = req.body;

    if (!firstname || !lastname || !email || !phone || !message) {
      return res.status(400).send("All fields are required.");
    }

    await transporter.sendMail({
      from: `"Website Contact" <${process.env.EMAIL_USER}>`,
      to: "Actuallyblog44@gmail.com",
      subject: "New Contact Us Submission",
      text: `New Contact Us Submission:
        - Name: ${firstname} ${lastname}
        - Email: ${email}
        - Phone: ${phone}
        - Message: ${message}`,
    });

    res.render("thank-you.ejs");
  })
);

// Routes for blogs with pagination
app.get(
  "/",
  handleAsync(async (req, res) => {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 12;

    const query = "SELECT * FROM blog ORDER BY date DESC LIMIT $1 OFFSET $2";
    const result = await pool.query(query, [limit, offset]);

    const blogs = result.rows.map((blog) => ({
      ...blog,
      image: blog.image ? parseImageData(blog.image) : [],
      date: new Date(blog.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    }));

    res.render("index", { blogs, offset, limit });
  })
);

// Category-based routes
const categories = ["sports", "politics", "show-biz", "tech", "other"];
categories.forEach((category) =>
  app.get(
    `/${category}`,
    handleAsync(async (req, res) => {
      const offset = parseInt(req.query.offset) || 0;
      const limit = parseInt(req.query.limit) || 12;

      const query =
        "SELECT * FROM blog WHERE category = $1 ORDER BY date DESC LIMIT $2 OFFSET $3";
      const result = await pool.query(query, [category, limit, offset]);

      const blogs = result.rows.map((blog) => ({
        ...blog,
        image: blog.image ? parseImageData(blog.image) : [],
        date: new Date(blog.date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      }));

      res.render("index", { blogs, offset, limit });
    })
  )
);

// view blog/:id
app.get(
  "/blogs/:id",
  handleAsync(async (req, res) => {
    const result = await pool.query("SELECT * FROM blog WHERE id = $1", [
      parseInt(req.params.id),
    ]);
    if (!result.rows.length) {
      return res.status(404).send("Blog not found");
    }
    const blog = result.rows[0];
    // Properly parse the image field
    let images = [];
    if (blog.image) {
      try {
        const parsedBuffer = JSON.parse(blog.image.toString("utf-8"));
        if (
          parsedBuffer.type === "Buffer" &&
          Array.isArray(parsedBuffer.data)
        ) {
          const innerJSON = Buffer.from(parsedBuffer.data).toString("utf-8");
          const parsedImages = JSON.parse(innerJSON);

          if (Array.isArray(parsedImages)) {
            images = parsedImages.map((file) => ({
              type: file.type || "",
              path: `/uploads/${file.path.split("/").pop()}`,
            }));
          } else {
            console.warn(
              "Inner parsed image data is not an array:",
              parsedImages
            );
          }
        }
      } catch (error) {
        console.error("Error parsing image data for blog ID:", error);
      }
    }
    // Attach parsed images to the blog object
    blog.image = images;
    res.render("news.ejs", { blog });
  })
);

// Load more blogs route
app.get(
  "/load-more-blogs",
  handleAsync(async (req, res) => {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 12;

    const query = "SELECT * FROM blog ORDER BY date DESC LIMIT $1 OFFSET $2";
    const result = await pool.query(query, [limit, offset]);

    const blogs = result.rows.map((blog) => ({
      ...blog,
      image: blog.image ? parseImageData(blog.image) : [],
      date: new Date(blog.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    }));

    res.json({ blogs }); // JSON response
  })
);

// Create post route
app.get("/create-post", (req, res) => res.render("modify.ejs"));

// Submission route
app.post(
  "/submitpost",
  multiUpload,
  handleAsync(async (req, res) => {
    const { category, summary, news, date, author } = req.body;
    const files = req.files;

    const serializedFiles = files.map((file) => ({
      path: file.path,
      type: file.mimetype,
    }));

    await pool.query(
      "INSERT INTO blog_staging (category, summary, news, image, date, author) VALUES ($1, $2, $3, $4, $5, $6)",
      [category, summary, news, JSON.stringify(serializedFiles), date, author]
    );

    res.status(200).json({ message: "Your post has been submitted and is awaiting approval.", redirectUrl: "/create-post" });
    res.redirect("/create-post")
  })
);

// Review post route
app.get(
  "/review-posts",
  handleAsync(async (req, res) => {
    const result = await pool.query(
      "SELECT * FROM blog_staging ORDER BY date DESC"
    );

    // Decode the image data properly for rendering
    const posts = result.rows.map((post) => ({
      ...post,
      image: post.image
        ? JSON.parse(post.image).map((file) => ({
            type: file.type,
            content: `/uploads/${file.path.split("/").pop()}`, // Generate correct path for rendering
          }))
        : [],
      date: new Date(post.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    }));

    res.render("review.ejs", { posts });
  })
);

// Approve post route
app.post(
  "/approve/:id",
  handleAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const result = await pool.query("SELECT * FROM blog_staging WHERE id = $1", [
      id,
    ]);

    if (!result.rows.length) return res.status(404).send("Post not found.");

    const post = result.rows[0];
    const image = post.image ? JSON.stringify(post.image) : null; // FIX: Ensure image is valid JSON

    await pool.query(
      "INSERT INTO blog (category, summary, news, image, date, author) VALUES ($1, $2, $3, $4, $5, $6)",
      [post.category, post.summary, post.news, image, post.date, post.author]
    );

    await pool.query("DELETE FROM blog_staging WHERE id = $1", [id]);
    res.redirect("/review-posts");
  })
);

// Delete Post route
app.post(
  "/reject/:id",
  handleAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const result = await pool.query(
      "DELETE FROM blog_staging WHERE id = $1 RETURNING *",
      [id]
    );

    if (!result.rowCount) return res.status(404).send("Post not found.");
    res.redirect("/review-posts");
  })
);

// Search blog Route
app.get(
  "/search",
  handleAsync(async (req, res) => {
    const { q } = req.query; // `q` represents the search term.
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 12;

    // SQL query to fetch matching blogs with pagination
    const query = `
      SELECT * FROM blog
      WHERE topic ILIKE $1 OR summary ILIKE $1
      ORDER BY date DESC
      LIMIT $2 OFFSET $3
    `;
    const values = [`%${q}%`, limit, offset];
    const result = await db.query(query, values);

    // Format blogs with parsed images
    const blogs = result.rows.map((blog) => {
      let images = [];
      if (blog.image) {
        try {
          const parsedBuffer = JSON.parse(blog.image.toString("utf-8"));
          if (
            parsedBuffer.type === "Buffer" &&
            Array.isArray(parsedBuffer.data)
          ) {
            const innerJSON = Buffer.from(parsedBuffer.data).toString("utf-8");
            const parsedImages = JSON.parse(innerJSON);

            if (Array.isArray(parsedImages)) {
              images = parsedImages.map((file) => ({
                type: file.type || "",
                path: `/uploads/${file.path.split("/").pop()}`,
              }));
            }
          }
        } catch (error) {
          console.error("Error parsing image data:", error);
        }
      }

      return {
        ...blog,
        image: images,
        date: new Date(blog.date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      };
    });

    res.render("search", { blogs, search: q, offset, limit });
  })
);

// Contact Page route
app.get("/contact", (req, res) => res.render("contact.ejs"));

// Error Handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).send({ error: err.message });
  }
  if (err) {
    console.error(err);
    return res.status(500).send({ error: "An internal server error occurred." });
  }
  next();
});

// Server Start
app.listen(port, () =>
  console.log(`Server running at http://localhost:${port}`)
);
