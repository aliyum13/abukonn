// Department -> faculty mapping, mirrored from the web app's
// web/src/lib/departments.tsx. Kept here so backend queries (e.g. the Discover
// People sections) can resolve which faculty a user's department belongs to.
// Keep this in sync with the frontend source of truth.

const DEPARTMENT_GROUPS = [
  { faculty: 'Faculty of Administration', departments: ['Public Administration', 'Local Government and Development Studies'] },
  { faculty: 'Faculty of Agriculture', departments: ['Soil Science', 'Agricultural Economics', 'Agricultural Extension and Rural Development', 'Agronomy', 'Animal Science', 'Crop Protection', 'Plant Science'] },
  { faculty: 'Faculty of Arts', departments: ['African Languages and Cultures', 'Arabic', 'Archaeology', 'English and Literary Studies', 'French', 'History', 'Philosophy', 'Theatre and Performing Arts'] },
  { faculty: 'Faculty of Education', departments: ['Arts and Social Science Education', 'Library and Information Science Education', 'Vocational and Technical Education', 'Physical and Health Education', 'Science Education'] },
  { faculty: 'Faculty of Engineering', departments: ['Electrical and Electronics Engineering', 'Computer Engineering', 'Mechanical Engineering', 'Mechatronics Engineering', 'Metallurgical Engineering', 'Automotive Engineering', 'Telecommunication Engineering', 'Civil Engineering', 'Chemical Engineering', 'Agricultural and Bio-Resources Engineering', 'Water Resources Engineering', 'Polymer and Textile Engineering'] },
  { faculty: 'Faculty of Environmental Design', departments: ['Architecture', 'Quantity Survey and Geomatics', 'Urban and Regional Planning', 'Industrial Design', 'Fine Arts', 'Building'] },
  { faculty: 'Faculty of Law', departments: ['Public/Common Law', 'Islamic Law', 'Law'] },
  { faculty: 'Faculty of Social Sciences', departments: ['Sociology', 'Mass Communication', 'Political Science and International Studies'] },
  { faculty: 'Faculty of Life Sciences', departments: ['Biochemistry', 'Biology', 'Botany', 'Microbiology', 'Zoology'] },
  { faculty: 'Faculty of Physical Sciences', departments: ['Chemistry', 'Computer Science', 'Geography', 'Geology', 'Mathematics', 'Physics', 'Statistics'] },
  { faculty: 'Faculty of Pharmaceutical Sciences', departments: ['Pharmacy'] },
  { faculty: 'Faculty of Medicine (College of Health Sciences)', departments: ['Medicine', 'Dentistry', 'Nursing', 'Anatomy', 'Physiology', 'Medical Laboratory Science', 'Medical Radiography'] },
  { faculty: 'Faculty of Veterinary Medicine', departments: ['Veterinary Medicine'] },
  { faculty: 'ABU Business School', departments: ['Finance', 'Accounting', 'Business Administration', 'Actuarial Science', 'Insurance', 'Economics', 'Marketing'] },
  { faculty: 'Other', departments: ['Software Engineering', 'Information Technology', 'Electrical Engineering', 'Medicine & Surgery', 'Political Science', 'Nursing Science'] },
];

// Build a department -> faculty lookup.
const DEPT_TO_FACULTY = {};
for (const group of DEPARTMENT_GROUPS) {
  for (const dept of group.departments) {
    DEPT_TO_FACULTY[dept] = group.faculty;
  }
}

// Returns the faculty for a department, or null if unknown.
function facultyForDepartment(department) {
  if (!department) return null;
  return DEPT_TO_FACULTY[department] || null;
}

// Returns all department names in the same faculty as the given department
// (including the department itself). Empty array if the faculty is unknown.
function departmentsInSameFaculty(department) {
  const faculty = facultyForDepartment(department);
  if (!faculty) return department ? [department] : [];
  const group = DEPARTMENT_GROUPS.find((g) => g.faculty === faculty);
  return group ? group.departments : [department];
}

module.exports = {
  DEPARTMENT_GROUPS,
  facultyForDepartment,
  departmentsInSameFaculty,
};
