# Spec Delta

## Purpose

Keeps Messages, a profile, and a single post reachable no matter how the three block switches are set.

## ADDED Requirements

### Requirement: Messages, profiles, and single posts stay available
With any combination of the three switches on, Messages, a profile, and a single post SHALL load as Instagram loads them.

#### Scenario: [interaction] Messages, a profile, and a single post stay available
- **WHEN** any combination of the three switches is on and the person opens `https://www.instagram.com/direct/inbox/`, `https://www.instagram.com/<username>/`, or `https://www.instagram.com/p/<shortcode>/`
- **THEN** that page loads as Instagram loads it
