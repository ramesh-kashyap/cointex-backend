
const connection = require('../../config/database');
const bcrypt = require('bcrypt');


const changepass =async (req, res)=>{
    const {password, newpassword} = req.body
    const[user] = await connection.query("SELECT * FROM users WHERE phone =?", ["9876543210"]); 
    if(user.length){
      const hashedPassword = await bcrypt.hash(newpassword, 10);
      await connection.query("UPDATE users SET password = ?, PSD = ? WHERE phone = ?",[hashedPassword, newpassword, "9876543210"])
    }
    else{
      return res.status(404).json({message: "Somthing is wrong"});
    }
  }

  module.exports = {changepass};
