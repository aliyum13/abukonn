/**
 * Single source of truth for departments, grouped by faculty (official ABU
 * structure). Used across registration, profile settings, and the admin
 * Library / Timetable pickers.
 */

export const DEPARTMENT_GROUPS: { faculty: string; departments: string[] }[] = [
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
  // Preserved legacy names so existing users' saved departments still resolve.
  { faculty: 'Other', departments: ['Software Engineering', 'Information Technology', 'Electrical Engineering', 'Medicine & Surgery', 'Political Science', 'Nursing Science'] },
];

// Flat, deduplicated list of all department names.
export const DEPARTMENTS = Array.from(new Set(DEPARTMENT_GROUPS.flatMap((g) => g.departments)));

// Flat list sorted alphabetically — for simple pickers (e.g. registration)
// where a clean A–Z list reads better than faculty groupings.
export const DEPARTMENTS_ALPHABETICAL = [...DEPARTMENTS].sort((a, b) => a.localeCompare(b));

export const LEVELS = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level', 'Postgraduate'] as const;

/**
 * Faculty-grouped <optgroup>/<option> elements for a department <select>.
 * Usage: <select ...><option value="">Department</option><DepartmentOptions /></select>
 */
export function DepartmentOptions() {
  return (
    <>
      {DEPARTMENT_GROUPS.map((group) => (
        <optgroup key={group.faculty} label={group.faculty}>
          {group.departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
