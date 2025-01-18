
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


  module.exports = {changepass, invite, changename};
