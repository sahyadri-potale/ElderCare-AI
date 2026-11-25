# ElderCare AI – Project Specification Sheet

**Project Type:** AI-Powered Elderly Care Web Application  
**Platform:** Responsive Web Application  
**Hackathon Duration:** 24 Hours  
**Project Category:** Artificial Intelligence, Healthcare Support & Social Impact

---

## 1. Project Overview

ElderCare AI is a multilingual, voice-first AI companion designed to support elderly people in their daily lives.

It provides friendly AI conversations, daily reminders, mood check-ins and easy communication with family members.

The application supports Kannada, Hindi and English, making it accessible to elderly users who may not be comfortable using English or typing on a keyboard.

It also provides a separate guardian dashboard, where family members can view information that the elderly user has explicitly agreed to share.

## 2. Problem Statement

Many elderly people face difficulties with:
- Remembering daily medicines and appointments.
- Using complicated digital applications.
- Finding someone to talk to during lonely moments.
- Communicating their daily well-being to family members.
- Using applications that do not support their preferred language.

ElderCare AI aims to make everyday digital assistance simpler, more accessible and more personal.

## 3. Project Objectives

1. Provide multilingual AI companionship.
2. Enable voice-based interaction instead of requiring typing.
3. Help elderly users manage daily reminders.
4. Encourage simple daily mood check-ins.
5. Improve family connection through consent-based sharing.
6. Provide an accessible interface with large buttons and readable text.

## 4. Target Users

**Primary User – Elderly Person**
- Uses the AI companion.
- Creates and manages reminders.
- Completes daily mood check-ins.
- Controls language and privacy settings.

**Secondary User – Guardian**
- Connects to an elderly user's account with their approval.
- Views information the elderly user has permitted.
- Receives shared weekly well-being summaries.

## 5. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js + Vite |
| Backend | Node.js |
| Backend Framework | Express.js |
| Database | MongoDB |
| Database Integration | Mongoose |
| AI Integration | Google Gemini API |
| Speech Recognition | Browser Speech Recognition |
| Voice Output | Browser Speech Synthesis |
| Styling | HTML, CSS, JavaScript |
| Development Assistance | Codex |
| Version Control | Git and GitHub |

## 6. Core Features

### 6.1 Multilingual Voice Assistant
- Supports Kannada, Hindi and English.
- Allows users to select their preferred language manually.
- Converts speech into text.
- Sends user queries to Gemini AI through the backend.
- Converts AI responses into speech.
- Supports simple voice-based navigation and commands.

### 6.2 AI Emotional Companion
- Provides friendly conversations.
- Gives daily greetings.
- Asks users how they are feeling.
- Offers supportive and empathetic responses.
- Encourages users to connect with family when appropriate.

### 6.3 Smart Reminder System
- Medicine reminders.
- Doctor appointment reminders.
- Water reminders.
- Daily activity reminders.
- Custom reminders.
- Voice-based reminder creation.
- Pending and completed reminder status.

### 6.4 Daily Mood Check-In
- Allows users to select their daily mood.
- Mood options: Happy, Okay, Sad and Worried.
- Stores mood history.
- Displays simple weekly mood trends.
- Does not provide medical diagnoses.

### 6.5 Guardian Dashboard
- Separate guardian login.
- Connects guardian and elderly accounts with explicit approval.
- Displays permitted reminder information.
- Displays permitted mood summaries.
- Provides access to shared weekly reports.
- Respects the elderly user's privacy settings.

### 6.6 Weekly Well-Being Summary
- Weekly mood overview.
- Reminder completion information.
- Important shared updates.
- Simple summary for the guardian.
- Only includes information approved for sharing.

### 6.7 Emergency Assistance
- Easily accessible SOS button.
- Registered emergency contact details.
- One-touch calling option.
- Optional guardian notification.

This feature assists users in contacting someone; it does not claim to automatically detect medical emergencies.

### 6.8 Accessibility
- Large readable fonts.
- Large buttons.
- Simple navigation.
- High-contrast interface.
- Minimal typing.
- Kannada, Hindi and English language selection.
- Responsive desktop and mobile layouts.

## 7. Main Application Modules

1. Landing Page
2. Registration and Login
3. Elderly Dashboard
4. Guardian Dashboard
5. Voice Assistant
6. Reminder Management
7. Mood Tracker
8. Weekly Well-Being Reports
9. Emergency Contacts
10. Language and Privacy Settings

## 8. Database Design

| Collection | Purpose |
|---|---|
| Users | User details, login information and role |
| GuardianLinks | Guardian connection and consent |
| Reminders | Reminder details and completion status |
| MoodEntries | Daily mood records |
| UserPreferences | Language and personal preferences |
| Conversations | Necessary conversation history, where enabled |
| WeeklyReports | Generated weekly summaries |
| EmergencyContacts | Registered emergency contacts |

Passwords must be securely hashed. Sensitive information and API credentials must not be exposed in frontend code.

## 9. Basic Application Workflow

**Elderly User:**

1. Register or log in.
2. Select Kannada, Hindi or English.
3. Open the elderly dashboard.
4. Start a voice conversation.
5. Create and manage reminders.
6. Complete daily mood check-ins.
7. Manage guardian-sharing permissions.

**Guardian:**

1. Register or log in.
2. Request or accept an elderly account connection.
3. Wait for the elderly user's approval.
4. Open the guardian dashboard.
5. View permitted updates and weekly summaries.

## 10. Functional Requirements

- The system must support two user roles.
- Users must be able to register and log in.
- The application must support three manually selected languages.
- The voice assistant must accept speech input and provide spoken responses where browser support is available.
- Users must be able to create, edit and delete reminders.
- Mood check-ins must be saved.
- Guardians must only access information they are authorized to view.
- Users must be able to manage sharing permissions.
- Emergency contacts must be accessible through the application.

## 11. Non-Functional Requirements

- Responsive and accessible user interface.
- Secure authentication and authorization.
- Reliable database storage.
- Clear error messages.
- Simple user experience.
- Protected API credentials.
- Reasonable response time.
- Graceful handling of unsupported speech features or microphone permissions.

## 12. Privacy and Security

- Store hashed passwords, not plain-text passwords.
- Use authenticated and role-protected APIs.
- Keep Gemini API keys in backend environment variables.
- Require elderly-user approval before guardian access.
- Enforce permissions on the backend.
- Share only information explicitly permitted by the elderly user.
- Allow users to revoke sharing permissions.

## 13. Development Priority

**Priority 1 – Essential MVP**
- Project setup.
- Registration and login.
- Elderly and guardian roles.
- Three-language selection.
- Working AI voice assistant.
- Reminder creation and management.

**Priority 2 – Important Features**
- Mood check-in.
- Guardian connection and permissions.
- Guardian dashboard.
- Weekly well-being summary.

**Priority 3 – Additional Features**
- Emergency contact assistance.
- Personalized greetings.
- Voice-based navigation.
- Additional accessibility improvements.

## 14. Expected Outcome

A working, responsive ElderCare AI application that demonstrates how AI, multilingual voice interaction and consent-based family connectivity can make everyday assistance more accessible to elderly people.

**Project's Main Differentiator:** A multilingual, voice-first AI companion that combines daily assistance and emotional companionship with privacy-controlled family connectivity.

---

**Development Principle:** Build working features one by one. Test each module before moving to the next. Prioritize a reliable MVP over a large number of incomplete features.