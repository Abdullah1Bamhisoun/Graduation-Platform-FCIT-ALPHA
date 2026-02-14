# Grading Components Guide

## Overview
This guide documents the reusable grading component library built for the Graduation Project Platform's assessment system.

## Components

### 1. LikertScaleRow
**Location:** `/components/grading/LikertScaleRow.tsx`

A matrix row component for Likert scale (1-5) grading with radio buttons.

#### Props
```typescript
{
  label: string;              // Row label (e.g., "Chapter 1")
  name: string;               // Unique name for radio group
  value: number | null;       // Selected value (1-5)
  onChange: (value: number) => void;
  disabled?: boolean;         // Lock the row
  maxScore: number;           // Maximum score for this item
  scaledScore?: number;       // Optional scaled score display
  showScore?: boolean;        // Show/hide score column
  variant?: 'default' | 'striped';
  className?: string;
}
```

#### States
- **Default**: Unselected radios, ready for interaction
- **Hover**: Scale animation (110%) on radio buttons
- **Selected**: Blue accent color with green badge showing score
- **Disabled**: 50% opacity, cursor-not-allowed, "Locked" badge

#### Usage Example
```tsx
<LikertScaleRow
  label="Chapter 1 (Project Outlines)"
  name="chapter1"
  value={chapter1Score}
  onChange={setChapter1Score}
  maxScore={5}
  scaledScore={(chapter1Score / 5) * 4}
  variant="striped"
/>
```

---

### 2. TotalsChip
**Location:** `/components/grading/TotalsChip.tsx`

Small badge component for displaying grade totals with various styles.

#### Props
```typescript
{
  label: string;              // Label text
  current: number;            // Current score
  max: number;                // Maximum score
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;   // Show percentage calculation
  className?: string;
}
```

#### Variants
- **default**: Gray background
- **primary**: Blue background
- **success**: Green background
- **warning**: Amber background
- **danger**: Red background

#### Sizes
- **sm**: `px-2 py-1 text-xs`
- **md**: `px-3 py-1.5 text-sm` (default)
- **lg**: `px-4 py-2 text-base`

#### Usage Example
```tsx
<TotalsChip 
  label="Admin Marks" 
  current={12.5} 
  max={15} 
  variant="primary" 
  showPercentage 
/>
```

---

### 3. RubricSummaryCard
**Location:** `/components/grading/RubricSummaryCard.tsx`

Comprehensive summary card showing total scores, percentages, and breakdowns with progress bars.

#### Props
```typescript
{
  title: string;
  total: number;              // Current total score
  maxTotal: number;           // Maximum total score
  breakdown: Array<{
    name: string;
    score: number;
    max: number;
    color?: string;           // Optional gradient color
  }>;
  onExport?: (format: 'pdf' | 'csv') => void;
  showExport?: boolean;
  variant?: 'default' | 'gradient';
  className?: string;
}
```

#### Features
- **Color-coded grades**: 
  - 90%+ → Green
  - 80%+ → Blue
  - 70%+ → Yellow
  - 60%+ → Orange
  - <60% → Red
- **Animated progress bars**: 500ms ease-out transition
- **Export dropdown**: PDF and CSV options
- **Summary statistics**: Completed items count, Average percentage
- **Hover effects**: Items highlight on hover

#### Usage Example
```tsx
<RubricSummaryCard
  title="Grading Summary"
  total={17.5}
  maxTotal={20}
  breakdown={[
    { name: 'Chapter 1', score: 4, max: 5, color: 'from-blue-600 to-blue-500' },
    { name: 'Chapter 2', score: 3, max: 3, color: 'from-green-600 to-green-500' },
  ]}
  onExport={handleExport}
  variant="gradient"
/>
```

---

### 4. ConfirmGradeModal
**Location:** `/components/grading/ConfirmGradeModal.tsx`

Confirmation dialog for grading actions with different visual variants.

#### Props
```typescript
{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  variant?: 'default' | 'warning' | 'success' | 'info';
  confirmText?: string;       // Default: "Confirm"
  cancelText?: string;        // Default: "Cancel"
  details?: string[];         // Bullet point list
  showIcon?: boolean;         // Default: true
}
```

#### Variants
- **default**: Blue theme with CheckCircle icon
- **warning**: Amber theme with AlertCircle icon
- **success**: Green theme with CheckCircle icon
- **info**: Blue theme with Info icon

#### Usage Example
```tsx
<ConfirmGradeModal
  open={showModal}
  onOpenChange={setShowModal}
  onConfirm={handleSaveGrades}
  title="Save All Grades?"
  description="This will finalize and submit all grades for this group."
  variant="success"
  confirmText="Save Grades"
  details={[
    'Save the current grades',
    'Notify students via email',
    'Update grading history',
  ]}
/>
```

---

### 5. GradingToast
**Location:** `/components/grading/GradingToast.tsx`

Toast notification system with predefined grading messages.

#### Functions

##### showGradingToast
```typescript
showGradingToast({
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;          // Default: 3000ms
  action?: {
    label: string;
    onClick: () => void;
  };
});
```

##### Predefined Toasts (GradingToasts)
```typescript
GradingToasts.gradeSaved('Chapter 1')
GradingToasts.gradeUpdated('Chapter 2')
GradingToasts.allGradesSaved()
GradingToasts.missingGrades()
GradingToasts.invalidGrade(5)
GradingToasts.gradingLocked()
GradingToasts.draftSaved()
GradingToasts.evaluationApproved()
GradingToasts.changesRequested()
GradingToasts.exportStarted('pdf')
GradingToasts.exportCompleted('pdf')
```

#### Usage Example
```tsx
import { GradingToasts, showGradingToast } from '@/components/grading';

// Predefined toast
GradingToasts.gradeSaved('Chapter 1');

// Custom toast with action
showGradingToast({
  type: 'info',
  title: 'Draft Saved',
  message: 'Your progress has been saved.',
  action: {
    label: 'View',
    onClick: () => navigate('/drafts'),
  },
});
```

---

## Complete Integration Example

```tsx
import { useState } from 'react';
import {
  LikertScaleRow,
  TotalsChip,
  RubricSummaryCard,
  ConfirmGradeModal,
  GradingToasts,
} from '@/components/grading';

export function GradingPage() {
  const [scores, setScores] = useState({
    chapter1: null,
    chapter2: null,
    chapter3: null,
  });
  const [showConfirm, setShowConfirm] = useState(false);

  const calculateTotal = () => {
    return Object.values(scores).reduce((sum, score) => sum + (score || 0), 0);
  };

  const handleSave = () => {
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    // Save logic here
    GradingToasts.allGradesSaved();
  };

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1">
        <div className="mb-4">
          <TotalsChip 
            label="Current Total" 
            current={calculateTotal()} 
            max={11} 
            variant="primary" 
            showPercentage 
          />
        </div>

        <table className="w-full">
          <thead>
            <tr>
              <th>Chapter</th>
              <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            <LikertScaleRow
              label="Chapter 1"
              name="chapter1"
              value={scores.chapter1}
              onChange={(v) => setScores({ ...scores, chapter1: v })}
              maxScore={5}
              scaledScore={(scores.chapter1 || 0) / 5 * 4}
            />
            <LikertScaleRow
              label="Chapter 2"
              name="chapter2"
              value={scores.chapter2}
              onChange={(v) => setScores({ ...scores, chapter2: v })}
              maxScore={3}
              variant="striped"
            />
            <LikertScaleRow
              label="Chapter 3"
              name="chapter3"
              value={scores.chapter3}
              onChange={(v) => setScores({ ...scores, chapter3: v })}
              maxScore={3}
            />
          </tbody>
        </table>

        <button onClick={handleSave}>Save Grades</button>
      </div>

      {/* Sticky Sidebar */}
      <div className="w-80">
        <div className="sticky top-6">
          <RubricSummaryCard
            title="Grading Summary"
            total={calculateTotal()}
            maxTotal={11}
            breakdown={[
              { name: 'Chapter 1', score: scores.chapter1 || 0, max: 5 },
              { name: 'Chapter 2', score: scores.chapter2 || 0, max: 3 },
              { name: 'Chapter 3', score: scores.chapter3 || 0, max: 3 },
            ]}
            onExport={(format) => GradingToasts.exportStarted(format)}
          />
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmGradeModal
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleConfirm}
        title="Save All Grades?"
        description="Submit grades for all chapters."
        variant="success"
        details={['Save grades', 'Notify students', 'Update history']}
      />
    </div>
  );
}
```

---

## Component Showcase

Visit `/component-showcase` to see all components in action with interactive examples of:
- All component states (default, hover, selected, disabled)
- All variants and sizes
- Live interactions and animations
- Integration patterns

---

## Grade Breakdown (100 marks)

1. **Chapter Grading (Supervisor)** - 20 marks
2. **Peer Feedback** - 5 marks
3. **Admin Grading (Deliverables)** - 15 marks
4. **Committee Evaluation** - 40 marks
5. **Weekly Reports** - 20 marks

---

## Design Principles

### States
- **Default**: Clear, neutral appearance
- **Hover**: Subtle scale/color transitions
- **Selected**: Strong visual feedback (accent colors, badges)
- **Disabled**: Reduced opacity, locked badge

### Colors
- **Primary**: Blue (`var(--color-primary-600)`)
- **Success**: Green
- **Warning**: Amber
- **Danger**: Red
- **Neutral**: Gray

### Animations
- **Duration**: 300-500ms
- **Easing**: ease-out
- **Transform**: scale(1.1) on hover

### Accessibility
- Focus rings on all interactive elements
- Proper ARIA labels
- Keyboard navigation support
- Screen reader friendly

---

## Best Practices

1. **Always validate scores** before saving
2. **Show confirmation modals** for destructive actions
3. **Provide immediate feedback** with toasts
4. **Display real-time totals** in summary cards
5. **Lock completed grades** with disabled state
6. **Export functionality** for record-keeping
7. **Maintain audit trails** for all grading actions

---

## Support

For issues or feature requests, contact the development team.
