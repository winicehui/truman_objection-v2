const Script = require('../models/Script.js');
const User = require('../models/User');
const Actor = require('../models/Actor');
const Notification = require('../models/Notification');
const _ = require('lodash');

// From https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array) {
    let currentIndex = array.length,
        randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]
        ];
    }

    return array;
}

/**
 * GET /
 * Get list of posts for feed
 */
exports.getScript = (req, res, next) => {
    User.findById(req.user.id)
        .exec(function(err, user) {
            //User is no longer active - study is over
            if (!user.active) {
                req.logout();
                req.flash('errors', { msg: 'Account is no longer active. Study is over.' });
                res.redirect('/signup');
            }

            //Get the newsfeed
            Script.find()
                .where('class').equals(user.interest)
                .sort('postID')
                .populate('actor')
                .populate({
                    path: 'comments.actor',
                    populate: {
                        path: 'actor',
                        model: 'Actor'
                    }
                })
                .populate({
                    path: 'comments.subcomments.actor',
                    populate: {
                        path: 'actor',
                        model: 'Actor'
                    }
                })
                .exec(async function(err, script_feed) {
                    if (err) { return next(err); }

                    //Final array of all posts to go in the feed
                    let finalfeed = [];

                    // //While there are regular posts or user-made posts to add to the final feed
                    while (script_feed.length) {
                        let replyDictionary = {}; // where Key = parent comment reply falls under, value = the list of comment objects

                        //Looking at the post in script_feed[0] now.
                        //For this post, check if there is a user feedAction matching this post's ID and get its index.
                        const feedIndex = _.findIndex(user.feedAction, function(o) { return o.post == script_feed[0].id; });

                        if (feedIndex != -1) {
                            //User performed an action with this post
                            //Check to see if there are comment-type actions.
                            if (Array.isArray(user.feedAction[feedIndex].comments) && user.feedAction[feedIndex].comments) {
                                //There are comment-type actions on this post.
                                //For each comment on this post, add likes, flags, etc.
                                for (const commentObject of user.feedAction[feedIndex].comments) {
                                    if (commentObject.new_comment) {
                                        // This is a new, user-made comment. Add it to the comments
                                        // list for this post.
                                        const cat = {
                                            commentID: commentObject.new_comment_id,
                                            body: commentObject.body,
                                            likes: commentObject.liked ? 1 : 0,
                                            unlikes: commentObject.unliked ? 1 : 0,
                                            time: commentObject.videoTime,

                                            new_comment: commentObject.new_comment,
                                            liked: commentObject.liked,
                                            unliked: commentObject.unliked
                                        };

                                        if (commentObject.reply_to != null) {
                                            cat.reply_to = commentObject.reply_to;
                                            cat.parent_comment = commentObject.parent_comment;
                                            if (replyDictionary[commentObject.parent_comment]) {
                                                replyDictionary[commentObject.parent_comment].push(cat)
                                            } else {
                                                replyDictionary[commentObject.parent_comment] = [cat];
                                            }
                                        } else {
                                            script_feed[0].comments.push(cat);
                                        }
                                    } else {
                                        // This is not a new, user-created comment.
                                        // Get the comment index that corresponds to the correct comment
                                        const commentIndex = _.findIndex(script_feed[0].comments, function(o) { return o.id == commentObject.comment; });
                                        // If this comment's ID is found in script_feed, add likes, flags, etc.
                                        if (commentIndex != -1) {
                                            // Check if there is a like recorded for this comment.
                                            if (commentObject.liked) {
                                                // Update the comment in script_feed.
                                                script_feed[0].comments[commentIndex].liked = true;
                                                script_feed[0].comments[commentIndex].likes++;
                                            }
                                            if (commentObject.unliked) {
                                                // Update the comment in script_feed.
                                                script_feed[0].comments[commentIndex].unliked = true;
                                                script_feed[0].comments[commentIndex].unlikes++;
                                            }
                                            // Check if there is a flag recorded for this comment.
                                            if (commentObject.flagged) {
                                                script_feed[0].comments[commentIndex].flagged = true;
                                            }
                                        } else {
                                            script_feed[0].comments.forEach(function(comment, index) {
                                                const subcommentIndex = _.findIndex(comment.subcomments, function(o) { return o.id == commentObject.comment; });
                                                if (subcommentIndex != -1) {
                                                    // Check if there is a like recorded for this subcomment.
                                                    if (commentObject.liked) {
                                                        // Update the comment in script_feed.
                                                        script_feed[0].comments[index].subcomments[subcommentIndex].liked = true;
                                                        script_feed[0].comments[index].subcomments[subcommentIndex].likes++;
                                                    }
                                                    if (commentObject.unliked) {
                                                        // Update the subcomment in script_feed.
                                                        script_feed[0].comments[index].subcomments[subcommentIndex].unliked = true;
                                                        script_feed[0].comments[index].subcomments[subcommentIndex].unlikes++;
                                                    }
                                                    // Check if there is a flag recorded for this subcomment.
                                                    if (commentObject.flagged) {
                                                        script_feed[0].comments[index].subcomments[subcommentIndex].flagged = true;
                                                    }
                                                }
                                            })
                                        }
                                    }
                                }
                            }
                            script_feed[0].comments.sort(function(a, b) {
                                return b.time - a.time; // in descending order.
                            });

                            for (const [key, value] of Object.entries(replyDictionary)) {
                                const commentIndex = _.findIndex(script_feed[0].comments, function(o) { return o.commentID == key; });
                                script_feed[0].comments[commentIndex]["subcomments"] =
                                    script_feed[0].comments[commentIndex]["subcomments"].concat(value)
                                    .sort(function(a, b) {
                                        return a.time - b.time; // in descending order.
                                    });
                            }

                            // No longer looking at comments on this post.
                            // Now we are looking at the main post.
                            // Check if there user has viewed the post before.
                            // if (user.feedAction[feedIndex].readTime[0]) {
                            //     script_feed[0].read = true;
                            //     script_feed[0].state = 'read';
                            // } else {
                            //     script_feed[0].read = false;
                            //     script_feed[0].state = 'unread';
                            // }

                            // Check if there is a like recorded for this post.
                            if (user.feedAction[feedIndex].liked) {
                                script_feed[0].like = true;
                                script_feed[0].likes++;
                            }
                            // Check if there is a unlike recorded for this post. 
                            if (user.feedAction[feedIndex].unliked) {
                                script_feed[0].unlike = true;
                                script_feed[0].unlikes++;
                            }
                            //Check if there is a flag recorded for this post.
                            if (user.feedAction[feedIndex].flagged) {
                                script_feed[0].flag = true;
                            }

                            // Check if post has been flagged: remove it from feed array (script_feed)
                            // if (user.feedAction[feedIndex].flagTime[0]) {
                            //     script_feed.splice(0, 1);
                            // } //Check if post is from a blocked user: remove it from feed array (script_feed)
                            // else if (user.blocked.includes(script_feed[0].actor.username)) {
                            //     script_feed.splice(0, 1);
                            // } else {
                            finalfeed.push(script_feed[0]);
                            script_feed.splice(0, 1);
                            // }
                        } //user did not interact with this post
                        else {
                            //     if (user.blocked.includes(script_feed[0].actor.username)) {
                            //         script_feed.splice(0, 1);
                            //     } else {
                            script_feed[0].comments.sort(function(a, b) {
                                return b.time - a.time;
                            });
                            finalfeed.push(script_feed[0]);
                            script_feed.splice(0, 1);
                            // }
                        }
                    }

                    //sort the feed
                    finalfeed.sort(function(a, b) {
                        return a.postID - b.postID;
                    });

                    console.log("Script Size is now: " + finalfeed.length);
                    // console.log(finalfeed);
                    user.save((err) => {
                        if (err) {
                            return next(err);
                        }
                        res.render('script', { script: finalfeed, title: 'Feed' });
                    }); //end of user.save()
                    //end of Script.find() -- for ads
                }); //end of Script.find() -- for feed
        }); //end of User.findByID
}; //end of .getScript

/**
 * POST /feed/
 * Update user's actions on ACTOR posts. 
 */
exports.postUpdateFeedAction = (req, res, next) => {
    User.findById(req.user.id, (err, user) => {
        if (err) { return next(err); }

        //find the object from the right post in feed
        var feedIndex = _.findIndex(user.feedAction, function(o) { return o.post == req.body.postID; });

        if (feedIndex == -1) {
            var cat = {
                post: req.body.postID,
                postClass: req.body.postClass,
            };
            // add new post into correct location
            feedIndex = user.feedAction.push(cat) - 1;
        }
        //create a new Comment
        if (req.body.new_comment) {
            user.numComments = user.numComments + 1;
            var cat = {
                new_comment: true,
                new_comment_id: user.numComments + 63,
                body: req.body.comment_text,
                relativeTime: req.body.new_comment - user.createdAt,
                absTime: req.body.new_comment,
                videoTime: req.body.videoTime,
                liked: false,
                unliked: false,
                flagged: false,
                shared: false,
                reply_to: req.body.reply_to,
                parent_comment: req.body.parent_comment
            }
            user.feedAction[feedIndex].comments.push(cat);
        }

        //Are we doing anything with a comment?
        else if (req.body.commentID) {
            const isUserComment = (req.body.isUserComment == 'true');
            var commentIndex = (isUserComment) ?
                _.findIndex(user.feedAction[feedIndex].comments, function(o) {
                    return o.new_comment_id == req.body.commentID && o.new_comment == isUserComment
                }) :
                _.findIndex(user.feedAction[feedIndex].comments, function(o) {
                    return o.comment == req.body.commentID && o.new_comment == isUserComment
                });
            //no comment in this post-actions yet
            if (commentIndex == -1) {
                var cat = {
                    comment: req.body.commentID
                };
                user.feedAction[feedIndex].comments.push(cat);
                commentIndex = user.feedAction[feedIndex].comments.length - 1;
            }

            //LIKE A COMMENT
            if (req.body.like) {
                let like = req.body.like;
                if (user.feedAction[feedIndex].comments[commentIndex].likeTime) {
                    user.feedAction[feedIndex].comments[commentIndex].likeTime.push(like);

                } else {
                    user.feedAction[feedIndex].comments[commentIndex].likeTime = [like];
                }
                user.feedAction[feedIndex].comments[commentIndex].liked = !user.feedAction[feedIndex].comments[commentIndex].liked;
                if (req.body.isUserComment != 'true') user.numCommentLikes++;
            }

            //UNLIKE A COMMENT
            if (req.body.unlike) {
                let unlike = req.body.unlike;
                if (user.feedAction[feedIndex].comments[commentIndex].unlikeTime) {
                    user.feedAction[feedIndex].comments[commentIndex].unlikeTime.push(unlike);
                } else {
                    user.feedAction[feedIndex].comments[commentIndex].unlikeTime = [unlike];
                }
                user.feedAction[feedIndex].comments[commentIndex].unliked = !user.feedAction[feedIndex].comments[commentIndex].unliked;
                if (req.body.isUserComment != 'true') user.numCommentLikes--;
            }

            //FLAG A COMMENT
            else if (req.body.flag) {
                let flag = req.body.flag;
                if (user.feedAction[feedIndex].comments[commentIndex].flagTime) {
                    user.feedAction[feedIndex].comments[commentIndex].flagTime.push(flag);

                } else {
                    user.feedAction[feedIndex].comments[commentIndex].flagTime = [flag];
                }
                user.feedAction[feedIndex].comments[commentIndex].flagged = true;
            }

            //SHARE A COMMENT 
            else if (req.body.share) {
                console.log()
                let share = req.body.share;
                if (user.feedAction[feedIndex].comments[commentIndex].shareTime) {
                    user.feedAction[feedIndex].comments[commentIndex].shareTime.push(share);

                } else {
                    user.feedAction[feedIndex].comments[commentIndex].shareTime = [share];
                }
                user.feedAction[feedIndex].comments[commentIndex].shared = true;
            }
        }
        //Not a comment-- Are we doing anything with the post?
        else {
            //Flag event
            if (req.body.flag) {
                let flag = req.body.flag;
                if (!user.feedAction[feedIndex].flagTime) {
                    user.feedAction[feedIndex].flagTime = [flag];
                } else {
                    user.feedAction[feedIndex].flagTime.push(flag);
                }
                user.feedAction[feedIndex].flagged = !user.feedAction[feedIndex].flagged;
            }

            //Like event
            else if (req.body.like) {
                let like = req.body.like;
                if (!user.feedAction[feedIndex].likeTime) {
                    user.feedAction[feedIndex].likeTime = [like];
                } else {
                    user.feedAction[feedIndex].likeTime.push(like);
                }
                user.feedAction[feedIndex].liked = !user.feedAction[feedIndex].liked;
            }
            //Unlike event
            else if (req.body.unlike) {
                let unlike = req.body.unlike;
                if (!user.feedAction[feedIndex].unlikeTime) {
                    user.feedAction[feedIndex].unlikeTime = [unlike];
                } else {
                    user.feedAction[feedIndex].unlikeTime.push(unlike);
                }
                user.feedAction[feedIndex].unliked = !user.feedAction[feedIndex].unliked;
            }
            //Share event 
            else if (req.body.share) {
                let share = req.body.share;
                if (!user.feedAction[feedIndex].shareTime) {
                    user.feedAction[feedIndex].shareTime = [share];
                } else {
                    user.feedAction[feedIndex].shareTime.push(share);
                }
                user.feedAction[feedIndex].shared = true;
            } //Read event 
            else if (req.body.viewed) {
                let view = req.body.viewed;
                if (!user.feedAction[feedIndex].readTime) {
                    user.feedAction[feedIndex].readTime = [view];
                } else {
                    user.feedAction[feedIndex].readTime.push(view);
                }
                user.feedAction[feedIndex].rereadTimes++;
                user.feedAction[feedIndex].mostRecentTime = Date.now();
            } else if (req.body.videoAction) {
                user.feedAction[feedIndex].videoAction.push(req.body.videoAction);
            } else if (req.body.videoDuration) {
                user.feedAction[feedIndex].videoDuration.push(req.body.videoDuration);
            } else {
                console.log(req.body)
                console.log('Something in feedAction went crazy. You should never see this.');
            }
        }

        user.save((err) => {
            if (err) {
                if (err.code === 11000) {
                    req.flash('errors', { msg: 'Something in feedAction went crazy. You should never see this.' });
                    return res.redirect('/');
                }
                return next(err);
            }
            res.send({ result: "success", numComments: user.numComments });
        });
    });
};

/**
 * POST /messageSeen
 * Post whether offense or objection message is seen
 */
exports.postMessageSeen = (req, res, next) => {
    User.findById(req.user.id, (err, user) => {
        if (err) { return next(err); }
        if (req.body.offense) {
            user.offenseMessageSeen = true;
        }
        if (req.body.objection) {
            user.objectionMessageSeen = true;
        }
        user.save((err) => {
            if (err) {
                return next(err);
            }
            res.set('Content-Type', 'application/json; charset=UTF-8');
            res.send({ result: "success" });
        });
    });
};