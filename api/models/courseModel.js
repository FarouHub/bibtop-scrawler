'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var CourseSchema = new Schema({
  
  title: {
    type: String
  },
  date: {
    type: Date
  },
  region: {
    type: String
  },
  commune: {
    type: String
  },
  contact: {
    type: String
  },
  phone: {
    type: String
  },
  mail: {
    type: String
  },
  urlid: {
    type: String
  },
  random: {
	type: String  
  },
  lat: {
    type: Number  
  },
  long: {
    type: Number  
  }
  /*,
  description: {
    type: String
  },
  img: {
    type: String,
    default: 'running1.jpg'
  },
  date: {
    type: Date,
    default: Date.now
  },
  distance: {
    type: String
  },
  type: {
    type: [{
      type: String,
      enum: ['Trail', 'Cross', 'Course']
    }],
    default: ['Course']
  }*/
});

module.exports = mongoose.model('course', CourseSchema);
