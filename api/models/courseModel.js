'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var CourseSchema = new Schema({
  
  title: {
    type: String
  },
  start_date: {
    type: Date
  },
  end_date: {
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
  },
  depart: {
    type: String
  },
  service:{
    type: String
  },
  recompences: {
    type: String
  },
  animation: {
    type: String
  },
  epreuves: [{
    name: String,
    description: String,
    distance: Number,
    maxinscription : Number,
    prices: [{
      prix: Number,
      date: Date,
      type: String
    }]
  }]/*
  type: {
    type: [{
      type: String,
      enum: ['Trail', 'Cross', 'Course']
    }],
    default: ['Course']
  }*/
});

module.exports = mongoose.model('course', CourseSchema);
