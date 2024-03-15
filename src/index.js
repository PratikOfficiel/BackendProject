import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path: "./.env"
});

connectDB()
.then(()=>{
    
    const PORT = process.env.PORT || 8000;
    app.on("error",(err)=>{
        console.log("ERROR while connnecting mongodb in index.js: ",err);
        throw err;
    })

    app.listen(PORT, ()=>{
        console.log(`Server is running on Port: ${PORT}`);
    })

    
})
.catch((err)=>{
    console.log(`MongoDB connection failed in index.js: ${err}`);
})