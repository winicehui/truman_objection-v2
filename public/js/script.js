$(window).on("load", function() {
    let offenseSeen = false;
    let objectionSeen = false;
    $.post("/pageLog", {
        path: window.location.pathname + `?=v${$('.ui.fluid.card:visible').attr('index')}`,
        _csrf: $('meta[name="csrf-token"]').attr('content')
    });
    $('video').on("timeupdate", function() {
        const post = $(this).parents('.ui.fluid.card');
        const postTimeStamps = JSON.parse(post.attr('postTimeStamps'));
        const postTimeStampsDictionary = JSON.parse(post.attr('postTimeStampsDict'));
        for (const timestamp of postTimeStamps) {
            if (this.currentTime * 1000 > timestamp) {
                const comments = postTimeStampsDictionary[timestamp];
                for (const comment of comments) {
                    const commentElement = $(`.comment[index=${comment}]`);
                    if (!commentElement.is(":visible")) {
                        if (commentElement.parent('.subcomments').length) {
                            if (!commentElement.parent('.subcomments').is(":visible")) {
                                commentElement.parent('.subcomments').transition('fade up');
                            }
                        }
                        commentElement.addClass("glowBorder", 1000).transition('fade up');
                        setTimeout(function() {
                            commentElement.removeClass("glowBorder", 1000);
                        }, 2500);
                    }
                }
            }
        };

        const index = parseInt(post.attr("index"));
        const offense = {
            1: 34000,
            6: 30000,
            11: 39000
        }
        const objection = {
            1: 42000,
            6: 38000,
            11: 46000
        }
        if ([1, 6, 11].includes(index)) {
            if (this.currentTime * 1000 > offense[index] && !offenseSeen) {
                $.post("/messageSeen", {
                    offense: true,
                    _csrf: $('meta[name="csrf-token"]').attr('content')
                });
                offenseSeen = true;
            }
            if (this.currentTime * 1000 > objection[index] && !objectionSeen) {
                $.post("/messageSeen", {
                    objection: true,
                    _csrf: $('meta[name="csrf-token"]').attr('content')
                });
                objectionSeen = true;
            }
        }
    });

    // At the end of the video, just ensure all the comments appear.
    $('video').on("ended", function() {
        const post = $(this).parents('.ui.fluid.card');
        const postID = post.attr("postID");
        for (const comment of post.find('.comment.hidden')) {
            const commentElement = $(comment);
            if (!commentElement.is(":visible")) {
                if (commentElement.parent('.subcomments').length) {
                    if (!commentElement.parent('.subcomments').is(":visible")) {
                        commentElement.parent('.subcomments').transition('fade');
                    }
                }
                commentElement.addClass("glowBorder", 1000).transition('fade up');
                setTimeout(function() {
                    commentElement.removeClass("glowBorder", 1000);
                }, 2500);
            }
        }
        $.post("/feed", {
            postID: postID,
            videoAction: {
                action: 'ended',
                absTime: Date.now(),
            },
            _csrf: $('meta[name="csrf-token"]').attr('content')
        });
    });

    $('video').on("play", function() {
        const post = $(this).parents('.ui.fluid.card');
        const postID = post.attr("postID");
        $.post("/feed", {
            postID: postID,
            videoAction: {
                action: 'play',
                absTime: Date.now(),
                videoTime: this.currentTime,
            },
            _csrf: $('meta[name="csrf-token"]').attr('content')
        });
    })

    $('video').on("pause", function() {
        const post = $(this).parents('.ui.fluid.card');
        const postID = post.attr("postID");
        if (!this.seeking) {
            $.post("/feed", {
                postID: postID,
                videoAction: {
                    action: 'pause',
                    absTime: Date.now(),
                    videoTime: this.currentTime,
                },
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
        }
    })

    $('video').on("seeked", function() {
        const post = $(this).parents('.ui.fluid.card');
        const postID = post.attr("postID");
        $.post("/feed", {
            postID: postID,
            videoAction: {
                action: 'seeked',
                absTime: Date.now(),
                videoTime: this.currentTime,
            },
            _csrf: $('meta[name="csrf-token"]').attr('content')
        });
    })

    $('video').on("seeking", function() {
        const post = $(this).parents('.ui.fluid.card');
        const postID = post.attr("postID");
        $.post("/feed", {
            postID: postID,
            videoAction: {
                action: 'seeking',
                absTime: Date.now(),
                videoTime: this.currentTime,
            },
            _csrf: $('meta[name="csrf-token"]').attr('content')
        });
    })


    $('video').on("volumechange", function() {
        const post = $(this).parents('.ui.fluid.card');
        const postID = post.attr("postID");
        $.post("/feed", {
            postID: postID,
            videoAction: {
                action: 'volumechange',
                absTime: Date.now(),
                videoTime: this.currentTime,
                volume: (this.muted) ? 0 : this.volume
            },
            _csrf: $('meta[name="csrf-token"]').attr('content')
        });
    })

    //Buttons to switch videos
    $('button.circular.ui.icon.button.blue.centered').on("click", function() {
        const currentCard = $('.ui.fluid.card:visible');
        const postID = currentCard.attr("postID");

        i = 0;
        videoDuration = [];
        while (i < currentCard.find('video')[0].played.length) {
            videoDuration.push({
                startTime: currentCard.find('video')[0].played.start(i),
                endTime: currentCard.find('video')[0].played.end(i)
            })
            i++;
        }
        if (videoDuration.length != 0) {
            $.post("/feed", {
                postID: postID,
                videoDuration: videoDuration,
                _csrf: $('meta[name="csrf-token"]').attr('content')
            });
        }

        if (!currentCard.find('video')[0].paused) {
            currentCard.find('video').off("pause");
            currentCard.find('video').trigger('pause');
            currentCard.find('video').on("pause", function() {
                const post = $(this).parents('.ui.fluid.card');
                const postID = post.attr("postID");
                if (!this.seeking) {
                    $.post("/feed", {
                        postID: postID,
                        videoAction: {
                            action: 'pause',
                            absTime: Date.now(),
                            videoTime: this.currentTime,
                        },
                        _csrf: $('meta[name="csrf-token"]').attr('content')
                    });
                }
            })
        }

        const nextVid = parseInt($(this).attr('nextVid'));
        $.post("/pageLog", {
            path: window.location.pathname + `?v=${nextVid}`,
            _csrf: $('meta[name="csrf-token"]').attr('content')
        });

        if ($(this).hasClass("left")) {
            $('.ui.fluid.card:visible').transition('fly left');
            setTimeout(function() {
                $(`.ui.fluid.card[index=${nextVid}]`).transition('fly right');
            }, 500);
        } else {
            $('.ui.fluid.card:visible').transition('fly right');
            setTimeout(function() {
                $(`.ui.fluid.card[index=${nextVid}]`).transition('fly left');
            }, 500);
        }

        if (nextVid % 5 == 0) {
            $('button.left').addClass("hidden");
        } else {
            $('button.left').removeClass("hidden");
            $('button.left').attr('nextVid', nextVid - 1);
        }

        if (nextVid % 5 == 4) {
            $('button.right').addClass("hidden");
        } else {
            $('button.right').removeClass("hidden");
            $('button.right').attr('nextVid', nextVid + 1);
        }
    })
});