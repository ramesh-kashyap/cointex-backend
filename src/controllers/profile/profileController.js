
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
    console.log("user ID:",user);

    if(user.length){
      // const referralCode = user[0].referral_code;
      // console.log("Referral Code:", referralCode);
      const username = user[0].username; // Extract the username from the user object
      const[invite] = await connection.query("SELECT * FROM users WHERE referred_by=?",[username]);
      console.log("Username:", username);
      res.json({ success: true, invite});
    }
    else {
      res.status(404).json({ success: false, message: "User not found" });
     }
    }
    catch{
      console.error("Error Fatching user:",error.messages);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  }


  const multer = require("multer");
  // const upload = multer({ dest: './public/uploads/' });
  let storage = multer.diskStorage({
    destination: function (req, file, cb) {
      return cb(null, "./public/uploads/")
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
       return cb(null, file.fieldname + '-' + uniqueSuffix)
    }
});
  // const storage = multer.diskStorage({
  //   destination: (req, file, cb) => {
  //     cb(null, './public/uploads/'); 
  //   },
  //   filename: (req, file, cb) => {
  //     const uniqueSuffix = Date.now() + path.extname(file.originalname); 
  //     cb(null, uniqueSuffix);
  //   },
  // });
  
  const upload = multer({storage});
  const uploadImage = (req, res) => {
    res.json(req.body);
    upload.single("image")(req, res,  (err) => {
      console.log(req.body);
      // if (err) {
      //   console.error("Error during file upload:", err);
      //   return res.status(500).json({ message: "File upload failed." });
      // }
  
      // try {
      //   if (!req.file) {
      //     return res.status(400).json({ message: "No file uploaded." });
      //   }  
      //   const userId = req.user.userId;
      //   const filePath = `./uploads/${req.file}`;
      //   const [result] = async () => await connection.query("UPDATE users SET picture = ? WHERE id = ?",[req.file, userId]);
      //   if (result.affectedRows === 0) {
      //     return res.status(404).json({ message: "User not found." });
      //   } 
      //   res.status(200).json({ message: "File uploaded successfully.", filePath });
      // } catch (error) {
      //   console.error("Error during database update:", error.message);
      //   res.status(500).json({ message: "Error uploading file." });
      // }
    });
  };
  




  module.exports = {changepass, invite, changename, inviteCommession, uploadImage};
