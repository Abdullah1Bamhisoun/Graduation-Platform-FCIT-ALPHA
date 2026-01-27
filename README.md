# FCIT Graduation Project Platform (GPP)

A comprehensive web platform for managing graduation projects at the Faculty of Computing and Information Technology (FCIT), King Abdulaziz University.

## Overview

The Graduation Project Platform streamlines the entire graduation project workflow for CPIS-498 and CPIS-499 courses, supporting three distinct user roles:

- **Students**: Submit milestones, track deadlines, receive feedback, and view grades
- **Supervisors**: Review submissions, provide rubric-based grading, and monitor student progress
- **Coordinators/Admin**: Configure milestones, manage announcements, and export reports

## Features

### For Students
- **Dashboard**: Overview of pending actions, deadlines, and progress
- **Milestones & Deadlines**: Track all project milestones with due dates
- **Weekly Reports**: Submit regular progress updates to supervisors
- **Submission Management**: Upload documents with version control
- **Feedback & Grades**: View detailed rubric-based evaluations
- **Calendar**: Track important dates and events

### For Supervisors
- **Reviews Inbox**: Centralized view of pending submissions and weekly reports
- **Rubric-Based Grading**: Structured evaluation with per-criterion scoring and comments
- **Workflow Actions**: Approve submissions or request changes with feedback
- **Group Management**: Monitor assigned student groups
- **Schedule View**: Calendar of demos and presentations

### For Coordinators/Admin
- **Milestone Configuration**: Set deadlines, visibility, and late submission policies
- **KPI Dashboard**: Overview of submission volume, completion rates, and overdue items
- **Announcements Manager**: Publish targeted announcements
- **Exports & Audit**: Export grades, submissions, and activity logs
- **Audit Trail**: Complete system activity logging

## Technical Stack

- **React** with TypeScript
- **React Router** for navigation
- **Tailwind CSS v4** for styling
- **Shadcn/ui** components
- **Lucide React** icons
- **Sonner** for toast notifications

## Design System

### Colors
- Primary: `#1F7A5C` (Primary 600), `#176148` (Primary 700), `#E7F3EF` (Primary 100)
- Text: `#0B1220` (Text 900), `#5B6472` (Text 600)
- Semantic: Success `#16A34A`, Warning `#F59E0B`, Danger `#DC2626`, Info `#2563EB`

### Typography
- Font Family: Inter
- Display/Headings: 700 weight
- Body: 500 weight
- Sizes managed via CSS custom properties in `styles/globals.css`

### Status Badges
- Draft: Gray
- Submitted: Blue
- Under Review: Purple
- Changes Requested: Amber
- Approved: Green

## Key Pages

### Student Flow
1. Login → Student Dashboard
2. View Milestones → Select Milestone → Submit/View Submission
3. Weekly Reports → Create/View Reports
4. Feedback & Grades → View rubric breakdown and scores

### Supervisor Flow
1. Login → Supervisor Dashboard
2. Reviews Inbox → Select Submission → Review & Grade
3. Rubric scoring with per-criterion comments
4. Approve or Request Changes

### Admin Flow
1. Login → Admin Dashboard
2. Configure Milestones → Set deadlines and policies
3. Export Reports → Grades, submissions, activity logs
4. View Audit Trail

## Demo Access

Use the role switcher on the login screen to demo different user types:
- **Student**: Abdullah Bamhisoun (ID: 2236500)
- **Supervisor**: Dr. Abdulaziz Alsulami
- **Admin**: Dr. Abdulaziz Alsulami

## Sample Data

The application includes realistic mock data:
- 8 milestones across CPIS-498/499
- 3 submissions with feedback
- 2 weekly reports
- Rubric-based grading samples
- Audit log entries

## Navigation Structure

### Student
- Dashboard
- Milestones & Deadlines
- Weekly Reports
- Feedback & Grades
- Announcements
- Calendar
- Settings

### Supervisor
- Dashboard
- Reviews Inbox
- My Groups
- Schedule
- Announcements
- Settings

### Admin
- Dashboard
- Milestone Configuration
- Announcements Manager
- Exports & Audit
- User Management
- Settings

## Responsive Design

Desktop-first design optimized for 1440×900 resolution, responsive down to 1280×800. Mobile views can be added in future iterations.

## Accessibility

- WCAG AA color contrast
- Focus states on all interactive elements
- Semantic HTML structure
- Keyboard navigation support

## Future Enhancements

- Real backend integration (Supabase recommended)
- Group formation workflows
- Proposal submission process
- Real-time notifications
- Document preview with annotations
- Mobile-responsive layouts
- Arabic (RTL) localization
- SSO integration
- Advanced analytics dashboard

## Development Notes

- All colors use CSS custom properties for easy theming
- Components follow atomic design principles
- Toast notifications for user feedback
- Modal/drawer patterns for detailed views
- Version control for submissions
- Comprehensive audit logging

---

**Institution**: Faculty of Computing and Information Technology, King Abdulaziz University  
**Courses**: CPIS-498, CPIS-499  
**Platform**: Web-based, Desktop-first
