const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const scriptSchema = new mongoose.Schema({
    postID: Number, //ID of the post
    body: { type: String, default: '', trim: true }, //body of post
    picture: String, //picture for post
    likes: Number, //number of likes of post (randomly assigned in populate.js)
    unlikes: Number, //number of dislikes of post (randomly assigned in populate.js)
    actor: { type: Schema.ObjectId, ref: 'Actor' }, //actor of post
    time: Number,

    offense_time: Number,
    objection_time: Number,

    class: String, //For experimental use (can be used to define the type of post)

    // Sorted by least recent --> most recent
    comments: [new Schema({
        commentID: Number, //ID of the comment
        body: { type: String, default: '', trim: true }, //body of comment
        likes: Number, //number of likes of comment (randomly assigned in populate.js, assigned for offense)
        unlikes: Number, //number of dislikes of comment (randomly assigned in populate.js, assigned for offense)
        actor: { type: Schema.ObjectId, ref: 'Actor' }, //actor of comment
        time: Number, //time of comment in reference to video (in milliseconds)

        subcomments: [new Schema({
            commentID: Number, // ID of the comment
            body: { type: String, default: '', trim: true }, //body of comment
            likes: Number, //number of likes of comment (assigned for objection)
            unlikes: Number, //number of dislikes of comment (assigned for objection)
            actor: { type: Schema.ObjectId, ref: 'Actor' }, //actor of comment
            time: Number, //time of comment in reference to video (in milliseconds)

            new_comment: { type: Boolean, default: false },
            liked: { type: Boolean, default: false },
            unliked: { type: Boolean, default: false }
        })],

        new_comment: { type: Boolean, default: false },
        liked: { type: Boolean, default: false },
        unliked: { type: Boolean, default: false },
    }, { versionKey: false })]
}, { versionKey: false });

const Script = mongoose.model('Script', scriptSchema);
module.exports = Script;