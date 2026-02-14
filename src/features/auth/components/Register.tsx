import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Checkbox } from '../../../components/ui/checkbox';
import { GraduationCap, Users, CheckCircle, ArrowLeft, AlertCircle } from 'lucide-react';
import { addRegistration } from '../../../lib/pending-registrations';

type AccountType = 'student' | 'supervisor';
type Department = 'CS' | 'IT' | 'IS' | '';
type Term = 'First' | 'Second' | 'Summer' | '';

// Department options
const departments = [
  { value: 'CS', label: 'Computer Science (CS)' },
  { value: 'IT', label: 'Information Technology (IT)' },
  { value: 'IS', label: 'Information Systems (IS)' },
];

// Course mapping by department
const coursesByDepartment: Record<string, Array<{ value: string; label: string }>> = {
  CS: [
    { value: 'CPCS-498', label: 'CPCS-498' },
    { value: 'CPCS-499', label: 'CPCS-499' },
  ],
  IT: [
    { value: 'CPIT-498', label: 'CPIT-498' },
    { value: 'CPIT-499', label: 'CPIT-499' },
  ],
  IS: [
    { value: 'CPIS-498', label: 'CPIS-498' },
    { value: 'CPIS-499', label: 'CPIS-499' },
  ],
};

// Term options
const terms = [
  { value: 'First', label: 'First' },
  { value: 'Second', label: 'Second' },
  { value: 'Summer', label: 'Summer' },
];

// Term code mapping for Group ID format
const termCodeMap: Record<string, string> = {
  First: '01',
  Second: '02',
  Summer: '03',
};

// Mock Group IDs - In production, these would come from the backend API
// Format: GroupNumber_CourseNumber_Year_TermCode_Gender
const mockGroupIds = [
  // CS Groups
  '13_498_2026_01_M',
  '14_498_2026_01_M',
  '15_498_2026_01_F',
  '16_499_2026_01_M',
  '17_499_2026_01_F',
  '18_498_2026_02_M',
  '19_499_2026_02_F',
  '20_498_2026_03_M',

  // IT Groups
  '21_498_2026_01_M',
  '22_498_2026_01_F',
  '23_499_2026_01_M',
  '24_499_2026_02_F',

  // IS Groups
  '25_498_2026_01_M',
  '26_498_2026_01_F',
  '27_499_2026_01_M',
  '28_499_2026_02_M',
];

export function Register() {
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<AccountType>('student');
  const [submitted, setSubmitted] = useState(false);

  // Student fields - Basic Info
  const [studentFirstName, setStudentFirstName] = useState('');
  const [studentLastName, setStudentLastName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentConfirmPassword, setStudentConfirmPassword] = useState('');

  // Student fields - Academic Info
  const [department, setDepartment] = useState<Department>('');
  const [course, setCourse] = useState('');
  const [term, setTerm] = useState<Term>('');
  const [groupId, setGroupId] = useState('');

  // Student fields - Project Info
  const [teammateSubmittedIdea, setTeammateSubmittedIdea] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectIdea, setProjectIdea] = useState('');

  // Supervisor fields
  const [supervisorFirstName, setSupervisorFirstName] = useState('');
  const [supervisorLastName, setSupervisorLastName] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [supervisorConfirmPassword, setSupervisorConfirmPassword] = useState('');
  const [supervisorDepartment, setSupervisorDepartment] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Available courses based on selected department
  const [availableCourses, setAvailableCourses] = useState<Array<{ value: string; label: string }>>([]);

  // Available group IDs based on selected department, course, and term
  const [availableGroupIds, setAvailableGroupIds] = useState<string[]>([]);

  // Effect: Update available courses when department changes
  useEffect(() => {
    if (department && coursesByDepartment[department]) {
      setAvailableCourses(coursesByDepartment[department]);
      // Reset course selection when department changes
      setCourse('');
      setGroupId('');
      setAvailableGroupIds([]);
    } else {
      setAvailableCourses([]);
      setCourse('');
    }
  }, [department]);

  // Effect: Update available group IDs when course or term changes
  useEffect(() => {
    if (course && term) {
      // Extract course number (498 or 499) from course code
      const courseNumber = course.split('-')[1];
      const termCode = termCodeMap[term];

      // Filter mock group IDs that match the selected course and term
      const filteredGroups = mockGroupIds.filter((groupIdStr) => {
        const parts = groupIdStr.split('_');
        // Format: GroupNumber_CourseNumber_Year_TermCode_Gender
        return parts[1] === courseNumber && parts[3] === termCode;
      });

      setAvailableGroupIds(filteredGroups);
      // Reset group ID when filters change
      setGroupId('');
    } else {
      setAvailableGroupIds([]);
      setGroupId('');
    }
  }, [course, term]);

  // Validate Group ID format: GroupNumber_CourseNumber_Year_TermCode_Gender
  const validateGroupIdFormat = (groupIdStr: string): boolean => {
    const pattern = /^\d+_\d{3}_\d{4}_\d{2}_[MF]$/;
    return pattern.test(groupIdStr);
  };

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (accountType === 'student') {
      // Basic validation
      if (!studentFirstName.trim()) newErrors.firstName = 'First name is required';
      if (!studentLastName.trim()) newErrors.lastName = 'Last name is required';
      if (!studentId.trim()) newErrors.studentId = 'Student ID is required';
      if (!studentEmail.trim()) newErrors.email = 'Email is required';
      if (!studentPassword) newErrors.password = 'Password is required';
      if (studentPassword !== studentConfirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }

      // Academic validation
      if (!department) newErrors.department = 'Department is required';
      if (!course) newErrors.course = 'Course is required';
      if (!term) newErrors.term = 'Term is required';
      if (!groupId) newErrors.groupId = 'Group ID is required';

      // Validate Group ID format
      if (groupId && !validateGroupIdFormat(groupId)) {
        newErrors.groupId = 'Invalid Group ID format';
      }

      // Project name and idea validation
      if (!teammateSubmittedIdea && !projectName.trim()) {
        newErrors.projectName = 'Project name is required (or check the box if teammate submitted)';
      }
      if (!teammateSubmittedIdea && !projectIdea.trim()) {
        newErrors.projectIdea = 'Project idea is required (or check the box if teammate submitted)';
      }
    } else {
      // Supervisor validation
      if (!supervisorFirstName.trim()) newErrors.firstName = 'First name is required';
      if (!supervisorLastName.trim()) newErrors.lastName = 'Last name is required';
      if (!supervisorId.trim()) newErrors.supervisorId = 'Supervisor ID is required';
      if (!supervisorEmail.trim()) newErrors.email = 'Email is required';
      if (!supervisorPassword) newErrors.password = 'Password is required';
      if (supervisorPassword !== supervisorConfirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
      if (!supervisorDepartment) newErrors.department = 'Department is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Store registration for admin approval
    if (accountType === 'student') {
      addRegistration({
        accountType: 'student',
        name: `${studentFirstName} ${studentLastName}`,
        email: studentEmail,
        password: studentPassword,
        department,
        studentId,
        course,
        term,
        groupId,
        teammateSubmittedIdea,
        projectName: teammateSubmittedIdea ? undefined : projectName,
        projectIdea: teammateSubmittedIdea ? undefined : projectIdea,
      });
    } else {
      addRegistration({
        accountType: 'supervisor',
        name: `${supervisorFirstName} ${supervisorLastName}`,
        email: supervisorEmail,
        password: supervisorPassword,
        department: supervisorDepartment,
        employeeNumber: supervisorId,
      });
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex">
        {/* Left Panel - Success */}
        <div className="w-1/2 flex items-center justify-center p-12 bg-[var(--color-surface-white)]">
          <div className="w-full max-w-md text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-[var(--color-text-900)] mb-3">Request Submitted!</h1>
            <p className="text-[var(--color-text-600)] mb-8">
              Your account request has been sent to the admin for approval. You will be notified once your account is activated.
            </p>
            <Button onClick={() => navigate('/login')} className="w-full">
              Back to Login
            </Button>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-1/2 bg-gradient-to-br from-[var(--color-primary-600)] to-[var(--color-primary-700)] p-12 flex items-center justify-center text-white">
          <div className="max-w-md">
            <h2 className="text-white mb-6">What Happens Next?</h2>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-semibold">1</div>
                <div>
                  <h3 className="text-white mb-1">Admin Review</h3>
                  <p className="text-white/80">The admin will review your registration details</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-semibold">2</div>
                <div>
                  <h3 className="text-white mb-1">Account Activation</h3>
                  <p className="text-white/80">Once approved, your account will be activated</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-semibold">3</div>
                <div>
                  <h3 className="text-white mb-1">Get Started</h3>
                  <p className="text-white/80">Sign in and start using the Graduation Project Platform</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Registration Form */}
      <div className="w-1/2 flex items-center justify-center p-12 bg-[var(--color-surface-white)] overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <img src="/gpp-logo.png" alt="GPP FCIT KAU" className="w-64 mx-auto mb-6" />
            <h1 className="text-[var(--color-text-900)] mb-2">Create Account</h1>
            <p className="text-[var(--color-text-600)]">Register as a student or supervisor</p>
          </div>

          {/* Account Type Tabs */}
          <div className="flex gap-3 mb-6">
            <button
              type="button"
              onClick={() => setAccountType('student')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-[1.5px] transition-all ${
                accountType === 'student'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-[var(--color-border)] bg-white text-[var(--color-text-600)] hover:border-[var(--color-text-400)]'
              }`}
            >
              <GraduationCap className="w-5 h-5" />
              <span className="font-medium">Student</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType('supervisor')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-[1.5px] transition-all ${
                accountType === 'supervisor'
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-[var(--color-border)] bg-white text-[var(--color-text-600)] hover:border-[var(--color-text-400)]'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">Supervisor</span>
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {accountType === 'student' ? (
              <>
                {/* Student Form */}
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="s-fname">First Name *</Label>
                    <Input
                      id="s-fname"
                      placeholder="First name"
                      value={studentFirstName}
                      onChange={(e) => setStudentFirstName(e.target.value)}
                      className={`mt-1 ${errors.firstName ? 'border-red-500' : ''}`}
                    />
                    {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="s-lname">Last Name *</Label>
                    <Input
                      id="s-lname"
                      placeholder="Last name"
                      value={studentLastName}
                      onChange={(e) => setStudentLastName(e.target.value)}
                      className={`mt-1 ${errors.lastName ? 'border-red-500' : ''}`}
                    />
                    {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="s-id">Student ID *</Label>
                    <Input
                      id="s-id"
                      placeholder="e.g. 2136XXX"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className={`mt-1 ${errors.studentId ? 'border-red-500' : ''}`}
                    />
                    {errors.studentId && <p className="text-xs text-red-500 mt-1">{errors.studentId}</p>}
                  </div>
                  <div>
                    <Label htmlFor="s-email">University Email *</Label>
                    <Input
                      id="s-email"
                      type="email"
                      placeholder="Ahmed@stu.kau.edu.sa"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      className={`mt-1 ${errors.email ? 'border-red-500' : ''}`}
                    />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor="s-password">Password *</Label>
                  <Input
                    id="s-password"
                    type="password"
                    placeholder="Create a password"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    className={`mt-1 ${errors.password ? 'border-red-500' : ''}`}
                  />
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>

                <div>
                  <Label htmlFor="s-confirm-password">Confirm Password *</Label>
                  <Input
                    id="s-confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    value={studentConfirmPassword}
                    onChange={(e) => setStudentConfirmPassword(e.target.value)}
                    className={`mt-1 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  />
                  {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
                </div>

                {/* Academic Information */}
                <div className="pt-4 border-t border-[var(--color-border)]">
                  <h3 className="text-sm font-semibold text-[var(--color-text-900)] mb-4">Academic Information</h3>

                  {/* 1️⃣ Department Selection */}
                  <div className="mb-4">
                    <Label htmlFor="s-dept">Department *</Label>
                    <Select value={department} onValueChange={(val) => setDepartment(val as Department)}>
                      <SelectTrigger className={`mt-1 ${errors.department ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.value} value={dept.value}>
                            {dept.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department}</p>}
                  </div>

                  {/* 2️⃣ Course Selection (Conditional - shown after department selection) */}
                  {department && (
                    <div className="mb-4">
                      <Label htmlFor="s-course">Course *</Label>
                      <Select value={course} onValueChange={setCourse}>
                        <SelectTrigger className={`mt-1 ${errors.course ? 'border-red-500' : ''}`}>
                          <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCourses.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.course && <p className="text-xs text-red-500 mt-1">{errors.course}</p>}
                    </div>
                  )}

                  {/* 3️⃣ Term Selection */}
                  <div className="mb-4">
                    <Label htmlFor="s-term">Term *</Label>
                    <Select value={term} onValueChange={(val) => setTerm(val as Term)}>
                      <SelectTrigger className={`mt-1 ${errors.term ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent>
                        {terms.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.term && <p className="text-xs text-red-500 mt-1">{errors.term}</p>}
                  </div>

                  {/* 4️⃣ Group ID Selection (Dynamic - shown after department, course, and term) */}
                  {department && course && term && (
                    <div className="mb-4">
                      <Label htmlFor="s-group">Group ID *</Label>
                      <Select value={groupId} onValueChange={setGroupId}>
                        <SelectTrigger className={`mt-1 ${errors.groupId ? 'border-red-500' : ''}`}>
                          <SelectValue placeholder="Select your group ID" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableGroupIds.length > 0 ? (
                            availableGroupIds.map((gid) => (
                              <SelectItem key={gid} value={gid}>
                                {gid}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="_no_groups" disabled>
                              No groups available for this selection
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-[var(--color-text-600)] mt-1">
                        Format: GroupNumber_CourseNumber_Year_TermCode_Gender
                      </p>
                      {errors.groupId && <p className="text-xs text-red-500 mt-1">{errors.groupId}</p>}
                    </div>
                  )}
                </div>

                {/* 5️⃣ Project Idea Declaration (shown after group ID selection) */}
                {groupId && (
                  <div className="pt-4 border-t border-[var(--color-border)]">
                    <h3 className="text-sm font-semibold text-[var(--color-text-900)] mb-4">Project Information</h3>

                    {/* Teammate submitted idea checkbox */}
                    <div className="flex items-start space-x-3 mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <Checkbox
                        id="teammate-idea"
                        checked={teammateSubmittedIdea}
                        onCheckedChange={(checked) => {
                          setTeammateSubmittedIdea(checked as boolean);
                          if (checked) {
                            setProjectName(''); // Clear project name if teammate submitted
                            setProjectIdea(''); // Clear project idea if teammate submitted
                          }
                        }}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor="teammate-idea"
                          className="text-sm font-medium text-[var(--color-text-900)] cursor-pointer"
                        >
                          A teammate in my group has already submitted the project idea
                        </label>
                        <p className="text-xs text-[var(--color-text-600)]">
                          Check this box if someone in your group has already submitted the project idea
                        </p>
                      </div>
                    </div>

                    {/* Project Name and Idea inputs (shown only if checkbox is NOT checked) */}
                    {!teammateSubmittedIdea && (
                      <div className="space-y-4">
                        {/* Project Name */}
                        <div>
                          <Label htmlFor="proj-name">Project Name *</Label>
                          <Input
                            id="proj-name"
                            placeholder="Enter your project name"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            className={`mt-1 ${errors.projectName ? 'border-red-500' : ''}`}
                          />
                          <p className="text-xs text-[var(--color-text-600)] mt-1">
                            Provide a clear name for your graduation project
                          </p>
                          {errors.projectName && <p className="text-xs text-red-500 mt-1">{errors.projectName}</p>}
                        </div>

                        {/* Project Idea */}
                        <div>
                          <Label htmlFor="proj-idea">Project Idea *</Label>
                          <Textarea
                            id="proj-idea"
                            placeholder="Describe your project idea in detail..."
                            value={projectIdea}
                            onChange={(e) => setProjectIdea(e.target.value)}
                            className={`mt-1 ${errors.projectIdea ? 'border-red-500' : ''}`}
                            rows={4}
                          />
                          <p className="text-xs text-[var(--color-text-600)] mt-1">
                            Provide a clear description of your graduation project idea
                          </p>
                          {errors.projectIdea && <p className="text-xs text-red-500 mt-1">{errors.projectIdea}</p>}
                        </div>
                      </div>
                    )}

                    {/* Information message when checkbox is checked */}
                    {teammateSubmittedIdea && (
                      <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-green-800">
                          <p className="font-medium">No project idea submission required</p>
                          <p className="text-xs mt-1">
                            You will be linked to your selected group. The admin will verify the group association.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Approval Notice */}
                {groupId && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mt-4">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium">Admin Approval Required</p>
                      <p className="text-xs mt-1">
                        Your registration will be reviewed by an admin. You will be notified once your account is
                        approved and you can access the platform.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Supervisor Form */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sv-fname">First Name</Label>
                    <Input id="sv-fname" placeholder="First name" value={supervisorFirstName} onChange={(e) => setSupervisorFirstName(e.target.value)} className="mt-1" required />
                  </div>
                  <div>
                    <Label htmlFor="sv-lname">Last Name</Label>
                    <Input id="sv-lname" placeholder="Last name" value={supervisorLastName} onChange={(e) => setSupervisorLastName(e.target.value)} className="mt-1" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sv-id">Supervisor ID</Label>
                    <Input id="sv-id" placeholder="Employee ID" value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className="mt-1" required />
                  </div>
                  <div>
                    <Label htmlFor="sv-email">University Email</Label>
                    <Input id="sv-email" type="email" placeholder="Abdullah@kau.edu.sa" value={supervisorEmail} onChange={(e) => setSupervisorEmail(e.target.value)} className="mt-1" required />
                  </div>
                </div>

                <div>
                  <Label htmlFor="sv-password">Password</Label>
                  <Input id="sv-password" type="password" placeholder="Create a password" value={supervisorPassword} onChange={(e) => setSupervisorPassword(e.target.value)} className="mt-1" required />
                </div>

                <div>
                  <Label htmlFor="sv-confirm-password">Confirm Password</Label>
                  <Input id="sv-confirm-password" type="password" placeholder="Confirm your password" value={supervisorConfirmPassword} onChange={(e) => setSupervisorConfirmPassword(e.target.value)} className="mt-1" required />
                </div>

                <div>
                  <Label htmlFor="sv-dept">Department</Label>
                  <Select value={supervisorDepartment} onValueChange={setSupervisorDepartment} required>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.value} value={dept.value}>{dept.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Button type="submit" className="w-full mt-6">
              Submit for Approval
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="inline-flex items-center gap-1 text-[var(--color-primary-600)] hover:underline">
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>

      {/* Right Panel - Platform Info */}
      <div className="w-1/2 bg-gradient-to-br from-[var(--color-primary-600)] to-[var(--color-primary-700)] p-12 flex items-center justify-center text-white">
        <div className="max-w-md">
          <h2 className="text-white mb-6">Graduation Project Platform</h2>
          <p className="mb-8 text-white/90">
            A comprehensive platform for managing graduation projects at FCIT, King Abdulaziz University.
          </p>

          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-white mb-1">Track Milestones</h3>
                <p className="text-white/80">Monitor deadlines for chapters, reports, and presentations</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-white mb-1">Submit & Review</h3>
                <p className="text-white/80">Upload submissions and receive detailed feedback from supervisors</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-white mb-1">Transparent Grading</h3>
                <p className="text-white/80">View rubric-based evaluations and track your progress</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
