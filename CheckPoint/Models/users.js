const e = require('express');
const mongoose = require('mongoose');

const {Schema, model} = mongoose;

const userSchema = new Schema({
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    profilePicture: { type: String, default: 'account logo.png' },
});

const userData = model('User', userSchema);

// async function createUser(username, hashed, email, firstName, lastName) {
//     if (!username || !hashed || !email || !firstName || !lastName) {
//         throw new Error('All fields are required to create a user.');
//     }
//     const userExists = await userData.findOne({ $or: [{ username }, { email }] }).exec();
//     if (userExists) {
//         return false;
//     }
//     try {
//         await userData.create({
//             username,
//             password,
//             email,
//             firstName,
//             lastName,
//         })
//         return true;
//     }
//     catch (err) {
//         console.error('Error creating user:', err);
//         throw new Error('Failed to create user.');
//     }
// }
async function createUser(username, password, email, firstName, lastName) {
  if (!username || !password || !email || !firstName || !lastName) {
    throw new Error("All fields are required to create a user.");
  }

  const userExists = await userData.findOne({ $or: [{ username }, { email }] }).exec();
  if (userExists) return false;

  try {
    await userData.create({ username, password, email, firstName, lastName });
    return true;
  } catch (err) {
    console.error("Error creating user:", err);
    throw err;
  }
}


module.exports = {
    createUser,
    userData,
}