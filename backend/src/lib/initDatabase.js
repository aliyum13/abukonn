// The startup schema sequence, in dependency order: each table is created (or
// topped up with ADD COLUMN IF NOT EXISTS) before anything that references it.
// Lives here rather than inline in index.js so a test can run the exact same
// sequence against an empty database -- a table altered before it is created
// only shows up on a fresh database, never on production, which already has
// every table. Keep every step idempotent (IF NOT EXISTS) and keep a table's
// ALTERs in the same create* function as its CREATE.
const { createUsersTable } = require('../models/User');
const { createPostsTable, createPostLikesTable, createPostMediaTable } = require('../models/Post');
const { createCommentsTable } = require('../models/Comment');
const { createNewsTable } = require('../models/News');
const { createMessagesTables } = require('../models/Message');
const { createWhitelistTable } = require('../models/Whitelist');
const { createFollowsTable } = require('../models/Follow');
const { createNotificationsTable } = require('../models/Notification');
const { createGroupTables } = require('../models/Group');
const { createRepliesTable } = require('../models/Reply');
const { createStoriesTable, createStoryViewsTable, createStoryReactionsTable, createStoryRepliesTable } = require('../models/Story');
const { createConnectTables } = require('../models/Connect');
const { createHashtagTables } = require('../models/Hashtag');
const { createUserSettingsTable } = require('../models/UserSettings');
const { createHighlightsTable } = require('../models/Highlight');
const { createProfileViewsTable } = require('../models/ProfileView');
const { createPaymentsTable } = require('../models/Payment');
const { createPostViewsTable } = require('../models/PostView');
const { createChannelTables } = require('../models/Channel');
const { createPasswordResetsTable } = require('../models/PasswordReset');
const { createTimetableTable } = require('../models/Timetable');
const { createSupportTable } = require('../models/Support');
const { createLibraryTable } = require('../models/Library');
const { createReportBlockTables } = require('../models/ReportBlock');

async function initDatabase() {
  await createUsersTable();
  await createPostsTable();
  await createCommentsTable();
  await createNewsTable();
  await createMessagesTables();
  await createWhitelistTable();
  await createFollowsTable();
  await createPostLikesTable();
  await createPostMediaTable();
  await createNotificationsTable();
  await createGroupTables();
  await createRepliesTable();
  await createStoriesTable();
  await createStoryViewsTable();
  await require('../models/Story').createStoryMutesTable();
  await require('../models/Story').createStoryAudienceTables();
  await require('./push').createPushTokensTable();
  await createStoryReactionsTable();
  await createStoryRepliesTable();
  await createConnectTables();
  await createHashtagTables();
  await createUserSettingsTable();
  await createHighlightsTable();
  await createProfileViewsTable();
  await createPaymentsTable();
  await createPostViewsTable();
  await createChannelTables();
  await createPasswordResetsTable();
  await createTimetableTable();
  await require('../models/ClassRep').createClassRepsTable();
  await require('../models/TimetableOverride').createTimetableOverridesTable();
  await createSupportTable();
  await createLibraryTable();
  await require('../models/UserRole').createUserRolesTable();
  await createReportBlockTables();
  await require('../models/AcademicCalendar').createAcademicCalendarTable();
}

module.exports = { initDatabase };
