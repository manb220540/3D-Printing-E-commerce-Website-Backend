# 3D Printing E-commerce Website Backend

This is the backend repository for the 3D Printing E-commerce Website, a full-stack application designed to manage product sales, custom 3D printing orders, user authentication, and order tracking. Built with Node.js and Express, it integrates a MySQL database, email notifications, and an AI-powered chat assistant using the Gemini API.

---

## Features

- User authentication, profile management, and password updates.
- Product browsing, cart management, and order processing.
- Custom 3D printing orders with .stl file uploads and parameter settings (material, color, layer thickness, infill density, size).
- Order status notifications (shipped, delivered) and tracking with cancellation options for confirmed orders.
- Admin dashboard for managing orders, users, and blogs, with search functionality.
- AI chat assistant via Gemini API for user support.
- Email notifications for order updates.

---

## Prerequisites

- Node.js (v16.x or higher recommended)
- MySQL Server
- Git

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/manb220540/3D-Printing-E-commerce-Website-Backend.git
cd 3D-Printing-E-commerce-Website-Backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory and add the following variables with your specific values:

```bash
DB_HOST=your_database_host
DB_USER=your_database_username
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
JWT_SECRET=your_jwt_secret_key
PORT=your_port_number (e.g., 3000)
EMAIL_USER=your_email_username
EMAIL_PASS=your_email_password
EMAIL_SERVICE=your_email_service (e.g., gmail)
EMAIL_PORT=your_email_port (e.g., 587)
EMAIL_HOST=your_email_host (e.g., smtp.gmail.com)
GEMINI_API_KEY=your_gemini_api_key

```

- **DB_HOST:** The host address of your MySQL database (e.g., localhost).
- **DB_USER:** The username for your MySQL database.
- **DB_PASSWORD:** The password for your MySQL database.
- **DB_NAME:** The name of your MySQL database.
- **JWT_SECRET:** A secret key for JSON Web Token authentication (generate a random string).
- **PORT:** The port number on which the server will run (default is 3000).
- **EMAIL_USER:** The email address for sending notifications.
- **EMAIL_PASS:** The password or app-specific password for the email account.
- **EMAIL_SERVICE:** The email service provider (e.g., gmail).
- **EMAIL_PORT:** The port for the email service (e.g., 587 for TLS).
- **EMAIL_HOST:** The SMTP host for the email service (e.g., smtp.gmail.com).
- **GEMINI_API_KEY:** The API key for the Gemini AI service.

### 4. Set Up the Database

- Create a MySQL database with the name specified in `DB_NAME`.
- Import the database schema (if provided separately, e.g., via a `.sql` file) to set up the necessary tables.

### 5. Run the Application

- For development mode with auto-restart:

```bash
npm run dev
```

- For production mode

```bash
npm start
```

---

## Project Structure

```bash
frontend/
├── node_modules/       # Dependenciesinstalled via npm.
├── public/             #  Static files (e.g., uploads).
├── src/                # Source code files.
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── routes/
│   ├── utils/
├── .env                # Environment variables configuration.
├── App.js              # Main application file.
├── package.json        # Project metadata and dependencies
```

---

### Dependencies

- **Express:** Web framework for Node.js.
- **MySQL2:** MySQL database driver.
- **jsonwebtoken:** For authentication.
- **nodemailer:** For sending email notifications.
- **@google/generative-ai:** Gemini API integration.
- **multer:** For handling file uploads (e.g., .stl files).
- **cors:** Enable CORS for cross-origin requests.
- **dotenv:** Load environment variables from .env file.
- **nodemon:** Development tool for auto-restarting the server.
- **@loaders.gl/core:** For 3D file processing.
- **three:** 3D rendering library.
- **bcryptjs:** For password hashing.
- **express-async-handler:** Async error handling for Express.
- **fflate:** Compression utility.
- **body-parser:** Parse incoming request bodies.

---

### Contributing

Feel free to fork this repository, submit issues, or create pull requests. Please follow the existing code style and update `.gitignore` if necessary.

---

### License

This project is licensed under the ISC License.

---

### Contact

For questions or support, please open an issue or contact the maintainer.
