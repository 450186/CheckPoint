const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const reviewSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    gameId: {
      type: Number,
      required: true,
    },
    cachedName: {
      type: String,
      required: true,
      trim: true,
    },
    cachedCoverUrl: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    rating: {
      type: Number,
      required: true,
      min: 0.5,
      max: 5,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ userId: 1, gameId: 1 }, { unique: true });

module.exports = model("Review", reviewSchema);