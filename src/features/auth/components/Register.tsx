import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../../components/ui/select';
import {
  GraduationCap, Users, CheckCircle, ArrowLeft, AlertCircle, Eye, EyeOff, Lock,
} from 'lucide-react';
import { addRegistration } from '../../../lib/pending-registrations';
import { getPublicGroups, type PublicGroup } from '../../../services/groups';
import { getActiveCourses } from '../../../services/courses';
import type { Course } from '../../../types';
import { supabase } from '../../../lib/supabase';

type AccountType = 'student' | 'supervisor';
type Term = 'First' | 'Second' | 'Summer' | '';

const terms = [
  { value: 'First',  label: 'First' },
  { value: 'Second', label: 'Second' },
  { value: 'Summer', label: 'Summer' },
];

// ── Password Input helper ──────────────────────────────────────────────────────
function PasswordInput({
  id, placeholder, value, onChange, hasError,
}: {
  id: string; placeholder: string; value: string;
  onChange: (v: string) => void; hasError?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative mt-1">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`pr-10 ${hasError ? 'border-red-500' : ''}`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-600)] hover:text-[var(--color-text-900)]"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ── Email validation ───────────────────────────────────────────────────────────
const studentEmailRegex    = /^[a-zA-Z0-9._%+-]+@stu\.kau\.edu\.sa$/;
const supervisorEmailRegex = /^[a-zA-Z0-9._%+-]+@kau\.edu\.sa$/;

function validateEmail(email: string, type: AccountType): string {
  if (!email.trim()) return 'Email is required';
  if (type === 'student' && !studentEmailRegex.test(email))
    return 'Student email must end with @stu.kau.edu.sa';
  if (type === 'supervisor') {
    if (!supervisorEmailRegex.test(email) || email.toLowerCase().endsWith('@stu.kau.edu.sa'))
      return 'Supervisor email must end with @kau.edu.sa';
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────

export function Register() {
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<AccountType>('student');
  const [submitted,   setSubmitted]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Courses (fetched dynamically) ──────────────────────────────────────────
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  useEffect(() => {
    getActiveCourses()
      .then(setCourses)
      .finally(() => setCoursesLoading(false));
  }, []);

  // ── Student fields ─────────────────────────────────────────────────────────
  const [studentFirstName,       setStudentFirstName]       = useState('');
  const [studentLastName,        setStudentLastName]        = useState('');
  const [studentId,              setStudentId]              = useState('');
  const [studentEmail,           setStudentEmail]           = useState('');
  const [studentPassword,        setStudentPassword]        = useState('');
  const [studentConfirmPassword, setStudentConfirmPassword] = useState('');

  // Academic info – course selection only (no gender, no department)
  const [selectedCourseId,   setSelectedCourseId]   = useState('');
  const [term,               setTerm]               = useState<Term>('');

  // Has-idea toggle
  const [hasIdea, setHasIdea] = useState<boolean | null>(null);

  // Project fields (has-idea path)
  const [projectName, setProjectName] = useState('');
  const [projectIdea, setProjectIdea] = useState('');

  // Join-group fields (no-idea path)
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [publicGroups,    setPublicGroups]    = useState<PublicGroup[]>([]);
  const [groupsLoading,   setGroupsLoading]   = useState(false);

  const selectedGroup = publicGroups.find((g) => g.id === selectedGroupId) ?? null;
  const selectedCourse = courses.find((c) => c.id === selectedCourseId) ?? null;

  // ── Supervisor fields ──────────────────────────────────────────────────────
  const [supervisorFirstName,       setSupervisorFirstName]       = useState('');
  const [supervisorLastName,        setSupervisorLastName]        = useState('');
  const [supervisorId,              setSupervisorId]              = useState('');
  const [supervisorEmail,           setSupervisorEmail]           = useState('');
  const [supervisorPassword,        setSupervisorPassword]        = useState('');
  const [supervisorConfirmPassword, setSupervisorConfirmPassword] = useState('');

  // ── Validation errors ─────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch available groups when course or term changes (no-idea path only)
  useEffect(() => {
    setSelectedGroupId('');
    setPublicGroups([]);
    if (hasIdea !== false || !selectedCourseId) return;

    setGroupsLoading(true);
    // Groups are now fetched by course_id only (no gender/dept filter)
    getPublicGroups(undefined, undefined, undefined, selectedCourseId)
      .then(setPublicGroups)
      .finally(() => setGroupsLoading(false));
  }, [selectedCourseId, hasIdea]);

  // Reset idea state when toggle changes
  useEffect(() => {
    setSelectedGroupId('');
    setProjectName('');
    setProjectIdea('');
    setPublicGroups([]);
  }, [hasIdea]);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (accountType === 'student') {
      if (!studentFirstName.trim()) newErrors.firstName = 'First name is required';
      if (!studentLastName.trim())  newErrors.lastName  = 'Last name is required';
      if (!studentId.trim())        newErrors.studentId = 'Student ID is required';

      const emailErr = validateEmail(studentEmail, 'student');
      if (emailErr) newErrors.email = emailErr;

      if (!studentPassword)             newErrors.password        = 'Password is required';
      else if (studentPassword.length < 8) newErrors.password = 'Password must be at least 8 characters';
      if (studentPassword !== studentConfirmPassword)
        newErrors.confirmPassword = 'Passwords do not match';

      if (!selectedCourseId) newErrors.course = 'Course is required';
      if (!term)             newErrors.term   = 'Term is required';

      if (hasIdea === null) {
        newErrors.hasIdea = 'Please select whether you have a project idea';
      } else if (hasIdea === true) {
        if (!projectName.trim()) newErrors.projectName = 'Project name is required';
        if (!projectIdea.trim()) newErrors.projectIdea = 'Project idea is required';
      } else {
        if (!selectedGroupId) newErrors.groupId = 'Please select a group to join';
        if (selectedGroup && selectedGroup.membersCount >= 3)
          newErrors.groupId = 'This group is full (maximum 3 students)';
      }
    } else {
      if (!supervisorFirstName.trim()) newErrors.firstName   = 'First name is required';
      if (!supervisorLastName.trim())  newErrors.lastName    = 'Last name is required';
      if (!supervisorId.trim())        newErrors.supervisorId = 'Supervisor ID is required';

      const emailErr = validateEmail(supervisorEmail, 'supervisor');
      if (emailErr) newErrors.email = emailErr;

      if (!supervisorPassword)              newErrors.password        = 'Password is required';
      else if (supervisorPassword.length < 8) newErrors.password = 'Password must be at least 8 characters';
      if (supervisorPassword !== supervisorConfirmPassword)
        newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const email    = accountType === 'student' ? studentEmail    : supervisorEmail;
      const password = accountType === 'student' ? studentPassword : supervisorPassword;
      const fullName = accountType === 'student'
        ? `${studentFirstName} ${studentLastName}`.trim()
        : `${supervisorFirstName} ${supervisorLastName}`.trim();

      // Step 1: Create Supabase auth user → triggers confirmation email
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/account-confirmed`,
        },
      });
      if (signUpError) throw signUpError;

      // Step 2: Store registration data as pending (no password stored)
      if (accountType === 'student') {
        await addRegistration({
          accountType: 'student',
          name:        `${studentFirstName} ${studentLastName}`,
          email:       studentEmail,
          department:  'IS',
          studentId,
          courseId:    selectedCourseId,
          course:      selectedCourse?.code ?? '',
          term,
          groupId:              hasIdea === false ? selectedGroupId : undefined,
          projectName:          hasIdea === true  ? projectName     : undefined,
          projectIdea:          hasIdea === true  ? projectIdea     : undefined,
          teammateSubmittedIdea: hasIdea === false,
        });
      } else {
        await addRegistration({
          accountType:    'supervisor',
          name:           `${supervisorFirstName} ${supervisorLastName}`,
          email:          supervisorEmail,
          department:     'IS',
          employeeNumber: supervisorId,
        });
      }
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit registration. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success Screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-[var(--color-surface-white)]">
          <div className="w-full max-w-md text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-[var(--color-text-900)] mb-3">Check Your Email!</h1>
            <p className="text-[var(--color-text-600)] mb-8">
              A confirmation link has been sent to your email. Please confirm your email first, then wait for admin approval before logging in.
            </p>
            <Button onClick={() => navigate('/login')} className="w-full">Back to Login</Button>
          </div>
        </div>
        <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[var(--color-primary-600)] to-[var(--color-primary-700)] p-12 items-center justify-center text-white">
          <div className="max-w-md">
            <h2 className="text-white mb-6">What Happens Next?</h2>
            <ul className="space-y-4">
              {['Confirm Your Email', 'Admin Review', 'Get Started'].map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-semibold">{i + 1}</div>
                  <div>
                    <h3 className="text-white mb-1">{step}</h3>
                    <p className="text-white/80">{[
                      'Click the confirmation link sent to your university email',
                      'Your registration will be reviewed by the coordinator or admin',
                      'Once approved, sign in and start using the platform',
                    ][i]}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration Form ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-[var(--color-surface-white)] overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <img src="/gpp-logo.png" alt="GPP FCIT KAU" className="w-64 mx-auto mb-6" />
            <h1 className="text-[var(--color-text-900)] mb-2">Create Account</h1>
            <p className="text-[var(--color-text-600)]">Register as a student or supervisor</p>
          </div>

          {/* Account Type Tabs */}
          <div className="flex gap-3 mb-6">
            {(['student', 'supervisor'] as AccountType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setAccountType(type)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-[1.5px] transition-all capitalize ${
                  accountType === type
                    ? type === 'student'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-[var(--color-border)] bg-white text-[var(--color-text-600)] hover:border-[var(--color-text-400)]'
                }`}
              >
                {type === 'student' ? <GraduationCap className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                <span className="font-medium capitalize">{type}</span>
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {accountType === 'student' ? (
              <>
                {/* ── Student: Basic Info ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="s-fname">First Name *</Label>
                    <Input id="s-fname" placeholder="First name" value={studentFirstName}
                      onChange={(e) => setStudentFirstName(e.target.value)}
                      className={`mt-1 ${errors.firstName ? 'border-red-500' : ''}`} />
                    {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="s-lname">Last Name *</Label>
                    <Input id="s-lname" placeholder="Last name" value={studentLastName}
                      onChange={(e) => setStudentLastName(e.target.value)}
                      className={`mt-1 ${errors.lastName ? 'border-red-500' : ''}`} />
                    {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor="s-id">Student ID *</Label>
                  <Input id="s-id" placeholder="e.g. 2136XXX" value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className={`mt-1 ${errors.studentId ? 'border-red-500' : ''}`} />
                  {errors.studentId && <p className="text-xs text-red-500 mt-1">{errors.studentId}</p>}
                </div>

                <div>
                  <Label htmlFor="s-email">
                    University Email *{' '}
                    <span className="text-xs text-[var(--color-text-600)] font-normal">(must end with @stu.kau.edu.sa)</span>
                  </Label>
                  <Input id="s-email" type="email" placeholder="Ahmed@stu.kau.edu.sa" value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className={`mt-1 ${errors.email ? 'border-red-500' : ''}`} />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>

                <div>
                  <Label htmlFor="s-password">Password *</Label>
                  <PasswordInput id="s-password" placeholder="At least 8 characters"
                    value={studentPassword} onChange={setStudentPassword} hasError={!!errors.password} />
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>

                <div>
                  <Label htmlFor="s-confirm">Confirm Password *</Label>
                  <PasswordInput id="s-confirm" placeholder="Repeat your password"
                    value={studentConfirmPassword} onChange={setStudentConfirmPassword}
                    hasError={!!errors.confirmPassword} />
                  {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
                </div>

                {/* ── Student: Academic Info ── */}
                <div className="pt-4 border-t border-[var(--color-border)]">
                  <h3 className="text-sm font-semibold text-[var(--color-text-900)] mb-4">Academic Information</h3>

                  {/* Course selection – fetched dynamically, no hardcoded values */}
                  <div className="mb-4">
                    <Label>Course *</Label>
                    <Select
                      value={selectedCourseId}
                      onValueChange={(v) => { setSelectedCourseId(v); setHasIdea(null); }}
                      disabled={coursesLoading}
                    >
                      <SelectTrigger className={`mt-1 ${errors.course ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder={coursesLoading ? 'Loading courses…' : 'Select course'} />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code}{c.name ? ` — ${c.name}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.course && <p className="text-xs text-red-500 mt-1">{errors.course}</p>}
                  </div>

                  <div className="mb-4">
                    <Label>Term *</Label>
                    <Select value={term} onValueChange={(v) => setTerm(v as Term)}>
                      <SelectTrigger className={`mt-1 ${errors.term ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent>
                        {terms.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.term && <p className="text-xs text-red-500 mt-1">{errors.term}</p>}
                  </div>
                </div>

                {/* ── Has Idea Toggle (only shown when course + term selected) ── */}
                {selectedCourseId && term && (
                  <div className="pt-4 border-t border-[var(--color-border)]">
                    <h3 className="text-sm font-semibold text-[var(--color-text-900)] mb-3">Project Group</h3>
                    <p className="text-sm text-[var(--color-text-600)] mb-3">Do you have a project idea?</p>
                    <div className="flex gap-3 mb-4">
                      <button type="button" onClick={() => setHasIdea(true)}
                        className={`flex-1 py-3 px-4 rounded-lg border-[1.5px] text-sm font-medium transition-all ${
                          hasIdea === true
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-[var(--color-border)] bg-white text-[var(--color-text-600)] hover:border-[var(--color-text-400)]'
                        }`}>
                        Yes, I have an idea
                      </button>
                      <button type="button" onClick={() => setHasIdea(false)}
                        className={`flex-1 py-3 px-4 rounded-lg border-[1.5px] text-sm font-medium transition-all ${
                          hasIdea === false
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-[var(--color-border)] bg-white text-[var(--color-text-600)] hover:border-[var(--color-text-400)]'
                        }`}>
                        No, I'll join a group
                      </button>
                    </div>
                    {errors.hasIdea && <p className="text-xs text-red-500 mb-3">{errors.hasIdea}</p>}

                    {/* HAS IDEA: project fields */}
                    {hasIdea === true && (
                      <div className="space-y-4">
                        <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
                          <AlertCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-green-800">
                            A new group will be created for you automatically. Your teammates can join after registering.
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="proj-name">Project Name *</Label>
                          <Input id="proj-name" placeholder="Enter your project name"
                            value={projectName} onChange={(e) => setProjectName(e.target.value)}
                            className={`mt-1 ${errors.projectName ? 'border-red-500' : ''}`} />
                          {errors.projectName && <p className="text-xs text-red-500 mt-1">{errors.projectName}</p>}
                        </div>
                        <div>
                          <Label htmlFor="proj-idea">Project Idea *</Label>
                          <Textarea id="proj-idea" placeholder="Describe your project idea…"
                            value={projectIdea} onChange={(e) => setProjectIdea(e.target.value)}
                            className={`mt-1 ${errors.projectIdea ? 'border-red-500' : ''}`} rows={4} />
                          {errors.projectIdea && <p className="text-xs text-red-500 mt-1">{errors.projectIdea}</p>}
                        </div>
                      </div>
                    )}

                    {/* NO IDEA: join existing group */}
                    {hasIdea === false && (
                      <div>
                        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                          <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-blue-800">
                            Showing available groups for <strong>{selectedCourse?.code ?? 'your course'}</strong>.
                            Only groups with open slots are shown.
                          </p>
                        </div>
                        {groupsLoading ? (
                          <p className="text-sm text-[var(--color-text-600)] py-3">Loading available groups…</p>
                        ) : (
                          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                            <SelectTrigger className={`mt-1 ${errors.groupId ? 'border-red-500' : ''}`}>
                              <SelectValue placeholder="Select a group to join" />
                            </SelectTrigger>
                            <SelectContent>
                              {publicGroups.length === 0 ? (
                                <SelectItem value="_none" disabled>No groups available yet</SelectItem>
                              ) : (
                                publicGroups.map((g) => (
                                  <SelectItem key={g.id} value={g.id} disabled={g.membersCount >= 3}>
                                    Group {g.groupNumber}
                                    {g.projectName ? ` — ${g.projectName}` : ''}
                                    {' '}({g.membersCount}/3)
                                    {g.membersCount >= 3 ? ' — Full' : ''}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        )}
                        {errors.groupId && <p className="text-xs text-red-500 mt-1">{errors.groupId}</p>}
                      </div>
                    )}

                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mt-4">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">
                        <span className="font-medium">Approval Required — </span>
                        Your registration will be reviewed before you can access the platform.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* ── Supervisor Form ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sv-fname">First Name *</Label>
                    <Input id="sv-fname" placeholder="First name" value={supervisorFirstName}
                      onChange={(e) => setSupervisorFirstName(e.target.value)}
                      className={`mt-1 ${errors.firstName ? 'border-red-500' : ''}`} />
                    {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="sv-lname">Last Name *</Label>
                    <Input id="sv-lname" placeholder="Last name" value={supervisorLastName}
                      onChange={(e) => setSupervisorLastName(e.target.value)}
                      className={`mt-1 ${errors.lastName ? 'border-red-500' : ''}`} />
                    {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor="sv-id">Supervisor ID *</Label>
                  <Input id="sv-id" placeholder="Employee ID" value={supervisorId}
                    onChange={(e) => setSupervisorId(e.target.value)}
                    className={`mt-1 ${errors.supervisorId ? 'border-red-500' : ''}`} />
                  {errors.supervisorId && <p className="text-xs text-red-500 mt-1">{errors.supervisorId}</p>}
                </div>

                <div>
                  <Label htmlFor="sv-email">
                    University Email *{' '}
                    <span className="text-xs text-[var(--color-text-600)] font-normal">(must end with @kau.edu.sa)</span>
                  </Label>
                  <Input id="sv-email" type="email" placeholder="Abdullah@kau.edu.sa" value={supervisorEmail}
                    onChange={(e) => setSupervisorEmail(e.target.value)}
                    className={`mt-1 ${errors.email ? 'border-red-500' : ''}`} />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>

                <div>
                  <Label htmlFor="sv-password">Password *</Label>
                  <PasswordInput id="sv-password" placeholder="At least 8 characters"
                    value={supervisorPassword} onChange={setSupervisorPassword} hasError={!!errors.password} />
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>

                <div>
                  <Label htmlFor="sv-confirm">Confirm Password *</Label>
                  <PasswordInput id="sv-confirm" placeholder="Repeat your password"
                    value={supervisorConfirmPassword} onChange={setSupervisorConfirmPassword}
                    hasError={!!errors.confirmPassword} />
                  {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
                </div>
              </>
            )}

            {submitError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mt-4">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            <Button type="submit" className="w-full mt-4" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit for Approval'}
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

      {/* Right Panel (hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[var(--color-primary-600)] to-[var(--color-primary-700)] p-12 items-center justify-center text-white sticky top-0 h-screen">
        <div className="max-w-md">
          <h2 className="text-white mb-6">Graduation Project Platform</h2>
          <p className="mb-8 text-white/90">
            A comprehensive platform for managing graduation projects at FCIT, King Abdulaziz University.
          </p>
          <ul className="space-y-4">
            {[
              { title: 'Track Milestones',  desc: 'Monitor deadlines for chapters, reports, and presentations' },
              { title: 'Submit & Review',   desc: 'Upload submissions and receive detailed feedback from supervisors' },
              { title: 'Transparent Grading', desc: 'View rubric-based evaluations and track your progress' },
            ].map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white mb-1">{item.title}</h3>
                  <p className="text-white/80">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
