const mongoose = require('mongoose');

const RequirementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
    },
    category: {
      type: String,
      required: true,
      enum: [
        'e-permitting',
        'public-transit',
        'civic-engagement',
        'other',
      ],
    },
    status: {
      type: String,
      required: true,
      default: 'Submitted',
      enum: ['Submitted', 'Under Review', 'Planned', 'Completed'],
    },
    // This is the unique part: we link each requirement to the user who created it
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // This 'User' refers to the User.js model we just made
      required: true,
    },
  },
  {
    // This automatically adds "createdAt" and "updatedAt" fields.
    // This is a modern Mongoose feature.
    timestamps: true, 
  }
);

module.exports = mongoose.model('Requirement', RequirementSchema);