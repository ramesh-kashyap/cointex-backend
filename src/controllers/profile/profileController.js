
const { response } = require('express');
const connection = require('../../config/database');
const bcrypt = require('bcrypt');
const middlewareController = require('../../middleware/middlewareController')


const changepass =async (req, res)=>{
    userId=req.user.userId;
    const {password, newpassword} = req.body
    const[user] = await connection.query("SELECT * FROM users WHERE id =?", [userId]); 
    if(user.length){
      const hashedPassword = await bcrypt.hash(newpassword, 10);
      await connection.query("UPDATE users SET password = ?, PSD = ? WHERE id = ?",[hashedPassword, newpassword, userId]);
      res.json({ success:true});
    }
    else{
      return res.status(404).json({message: "Somthing is wrong"});
    }
  }

  const changename =async(req, res) =>{
    userId=req.user.userId;
    const {name} = req.body
    const[user] =await connection.query("SELECT * FROM users WHERE id =?",[userId]);
    if(user.length){
      await connection.query("UPDATE users SET name = ? WHERE id = ?",[name, userId]);
      res.json({ success:true});
    }
    else{
      return res.status(404).json({message:"Somthing is wrong"});
    }
  }


  const invite = async(req, res)=>{
    userId=req.user.userId;
    try{
    const[user] = await connection.query("SELECT * FROM users WHERE id =?",[userId]);
    console.log("user ID:",user);

    if(user.length){
      // const referralCode = user[0].referral_code;
      // console.log("Referral Code:", referralCode);
      res.json({ success: true, user});
    }
    else {
      res.status(404).json({ success: false, message: "User not found" });
     }
  }
  catch{
    console.error("Error fetching user:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

  const inviteCommession = async(req, res)=>{
    userId=req.user.userId;
    try{
      const[user] = await connection.query("SELECT * FROM users WHERE id =?",[userId]);
    // console.log("user ID:",user);
    if(user.length){
      // const referralCode = user[0].referral_code;
      // console.log("Referral Code:", referralCode);
      const username = user[0].referral_code; // Extract the username from the user object
      console.log("user name:",username);
      // const[invite] = await connection.query("SELECT * FROM users WHERE referred_by=?",[username]);
      let arrin = [username];// Start with the current user's referrals (Level 1)
      let ret = {}; // To store the referral levels
      let i = 1;
      try{
        while(username.length>0){
          const [rows] = await connection.query("SELECT * FROM users WHERE referred_by IN (?)",[arrin]);
          
          console.log(rows);
          if (rows.length > 0) {
            arrin = rows.map(row => row.username);
            ret[i] = arrin;
            i++;
            // console.log(i);
            if (i < 4) {
                break;
            }
        } else {
            arrin = [];
        }
        }
        // res.json({ success: true, rows});
           res.json({ success: true, ret});
          //  console.log('check:',ret);
      }
      catch{
        console.error("Error fetching referrals:", error);
        // throw new Error('Internal Server Error');
      }

      // console.log("Username:", username);
      // res.json({ success: true, data: ret });
      // res.json({ success: true, invite});
    }
    else {
      res.status(404).json({ success: false, message: "User not found" });
     }
    }
    catch{
      // console.error("Error Fatching user:",error.messages);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  }


  const multer = require("multer");
 
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/uploads/"); // Destination folder
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix); // Unique filename
  },
});

// const upload = multer({ storage }).single("image"); // Configure multer for single file upload
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true); // Accept file
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  },
}).single('image');


const uploadImage = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(500).json({ message: "File upload failed.", error: err.message });
    }

    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const userId = req.user.userId;
    const filePath = `./uploads/${req.file.filename}`;

    // Step 1: Fetch current picture path from the database
   

    try {
      // Update the user's picture in the database
      const [result] = await connection.query("UPDATE users SET picture = ? WHERE id = ?", [filePath, userId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "User not found." });
      }

      // Successfully uploaded file and updated user
      console.log("Authenticated User:", req.user); // User data from authenticateJWT middleware
      console.log("Request Body:", req.body); // Form data
      console.log("Uploaded File:", req.file); // Uploaded file details

      return res.status(200).json({
        message: "File uploaded successfully.",
        file: req.file, // File details
      });
    } catch (error) {
      console.error("Error during database update:", error.message);
      return res.status(500).json({ message: "Error uploading file." });
    }
  });
};




  module.exports = {changepass, invite, changename, inviteCommession, uploadImage};
