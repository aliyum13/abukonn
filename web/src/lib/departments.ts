/**
 * Single source of truth for the list of departments used across the app —
 * registration, profile settings, and the admin Library / Timetable upload
 * pickers. Add a department here once and it appears everywhere.
 */
export const DEPARTMENTS = [
  'Computer Science',
  'Software Engineering',
  'Information Technology',
  'Electrical Engineering',
  'Civil Engineering',
  'Mechanical Engineering',
  'Medicine & Surgery',
  'Law',
  'Economics',
  'Accounting',
  'Business Administration',
  'Marketing',
  'Finance',
  'Actuarial Science',
  'Insurance',
  'Mass Communication',
  'Political Science',
  'Sociology',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biochemistry',
  'Microbiology',
  'Pharmacy',
  'Nursing Science',
] as const;

export const LEVELS = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level', 'Postgraduate'] as const;
