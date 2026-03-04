const mongoose = require('mongoose');

const {Schema, model} = mongoose;

const librarySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  gameId: { type: Number, required: true, index: true },

  status: { type: String, enum: ['playing','completed','wishlist','dropped'], default: 'wishlist' },
  userRating: { type: Number, min: 0, max: 10 },
  review: { type: String, trim: true, maxlength: 2000 },
  startedAt: { type: Date },
  completedAt: { type: Date },

  cachedName: { type: String, required: true, trim: true },
  cachedCoverUrl: { type: String, trim: true },

  cachedGenres: { type: String, trim: true },
  cachedRating: { type: Number },
  cachedRelease: { type: String, trim: true },

  cachedReleaseDate: { type: Date },
}, { timestamps: true });

//prevent duplicate entries for the same game by the same user
librarySchema.index({ userId: 1, gameId: 1 }, { unique: true });

module.exports = model('Library', librarySchema);

