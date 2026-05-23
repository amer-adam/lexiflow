const prisma = require('../../config/prisma');

/**
 * Upsert user watch progress for a video.
 */
async function upsertProgress(userId, videoId, currentTime, duration) {
    try {
        const record = await prisma.userWatchProgress.upsert({
            where: {
                userId_videoId: {
                    userId,
                    videoId
                }
            },
            update: {
                currentTime,
                duration,
                updatedAt: new Date()
            },
            create: {
                userId,
                videoId,
                currentTime,
                duration,
                lastSegmentIndexSeen: -1
            }
        });
        return record;
    } catch (error) {
        console.error(`Error in upsertProgress for user ${userId}, video ${videoId}:`, error);
        throw error;
    }
}

/**
 * Get user watch progress for a video.
 */
async function getProgress(userId, videoId) {
    try {
        const record = await prisma.userWatchProgress.findUnique({
            where: {
                userId_videoId: {
                    userId,
                    videoId
                }
            }
        });
        return record;
    } catch (error) {
        console.error(`Error in getProgress for user ${userId}, video ${videoId}:`, error);
        throw error;
    }
}

/**
 * Get last segment index seen by a user for a video.
 */
async function getLastSegmentIndexSeen(userId, videoId) {
    try {
        const record = await prisma.userWatchProgress.findUnique({
            where: {
                userId_videoId: {
                    userId,
                    videoId
                }
            },
            select: {
                lastSegmentIndexSeen: true
            }
        });
        return record ? record.lastSegmentIndexSeen : -1;
    } catch (error) {
        console.error(`Error in getLastSegmentIndexSeen for user ${userId}, video ${videoId}:`, error);
        throw error;
    }
}

/**
 * Update the last segment index seen by a user for a video.
 */
async function updateLastSegmentIndexSeen(userId, videoId, segmentIndex) {
    try {
        const record = await prisma.userWatchProgress.update({
            where: {
                userId_videoId: {
                    userId,
                    videoId
                }
            },
            data: {
                lastSegmentIndexSeen: segmentIndex,
                updatedAt: new Date()
            }
        });
        return record;
    } catch (error) {
        console.error(`Error in updateLastSegmentIndexSeen for user ${userId}, video ${videoId}, segment: ${segmentIndex}:`, error);
        throw error;
    }
}

module.exports = {
    upsertProgress,
    getProgress,
    getLastSegmentIndexSeen,
    updateLastSegmentIndexSeen
};
