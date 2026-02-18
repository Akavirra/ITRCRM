/**
 * Student Study Status Tests
 * 
 * Tests the automatic study status logic:
 * - "studying" when student is in at least one active group
 * - "not_studying" when student is not in any active group
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { initializeDatabase, getDb } from '@/db/index';
import { 
  getStudents, 
  getStudentsWithGroupCount, 
  getStudentById,
  computeStudyStatus,
  STUDY_STATUS,
  type Student
} from '@/lib/students';
import { addStudentToGroup, removeStudentFromGroupByIDs } from '@/lib/groups';

describe('Student Study Status Logic', () => {
  let testCourseId: number;
  let testGroupId: number;
  let testTeacherId: number;
  let testStudent1Id: number;
  let testStudent2Id: number;
  let testGroup2Id: number;
  
  beforeAll(() => {
    // Initialize test database
    initializeDatabase();
    const db = getDb();
    
    // Create test teacher
    const teacherResult = db.prepare(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)'
    ).run('Test Teacher', 'test-teacher-status@test.com', 'hash', 'teacher', 1);
    testTeacherId = teacherResult.lastInsertRowid as number;
    
    // Create test course
    const courseResult = db.prepare(
      'INSERT INTO courses (title, age_min, duration_months, is_active) VALUES (?, ?, ?, ?)'
    ).run('Test Course Status', 6, 1, 1);
    testCourseId = courseResult.lastInsertRowid as number;
    
    // Create test groups
    const group1Result = db.prepare(
      'INSERT INTO groups (course_id, teacher_id, title, weekly_day, start_time, is_active) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(testCourseId, testTeacherId, 'Test Group 1', 1, '10:00', 1);
    testGroupId = group1Result.lastInsertRowid as number;
    
    const group2Result = db.prepare(
      'INSERT INTO groups (course_id, teacher_id, title, weekly_day, start_time, is_active) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(testCourseId, testTeacherId, 'Test Group 2', 2, '11:00', 1);
    testGroup2Id = group2Result.lastInsertRowid as number;
    
    // Create test students
    const student1Result = db.prepare(
      'INSERT INTO students (full_name, phone, is_active) VALUES (?, ?, ?)'
    ).run('Test Student Status 1', '+380501234567', 1);
    testStudent1Id = student1Result.lastInsertRowid as number;
    
    const student2Result = db.prepare(
      'INSERT INTO students (full_name, phone, is_active) VALUES (?, ?, ?)'
    ).run('Test Student Status 2', '+380501234568', 1);
    testStudent2Id = student2Result.lastInsertRowid as number;
  });
  
  afterAll(() => {
    const db = getDb();
    
    // Clean up in correct order (respecting foreign keys)
    db.prepare('DELETE FROM student_groups WHERE student_id IN (?, ?)').run(testStudent1Id, testStudent2Id);
    db.prepare('DELETE FROM students WHERE id IN (?, ?)').run(testStudent1Id, testStudent2Id);
    db.prepare('DELETE FROM groups WHERE id IN (?, ?)').run(testGroupId, testGroup2Id);
    db.prepare('DELETE FROM courses WHERE id = ?').run(testCourseId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testTeacherId);
  });
  
  describe('computeStudyStatus', () => {
    it('should return "studying" when groups count > 0', () => {
      expect(computeStudyStatus(1)).toBe(STUDY_STATUS.STUDYING);
      expect(computeStudyStatus(5)).toBe(STUDY_STATUS.STUDYING);
      expect(computeStudyStatus(100)).toBe(STUDY_STATUS.STUDYING);
    });
    
    it('should return "not_studying" when groups count is 0', () => {
      expect(computeStudyStatus(0)).toBe(STUDY_STATUS.NOT_STUDYING);
    });
  });
  
  describe('getStudents - study_status field', () => {
    it('should return students with study_status field', () => {
      const students = getStudents(false);
      
      expect(students.length).toBeGreaterThan(0);
      
      // Find our test students
      const student1 = students.find(s => s.id === testStudent1Id);
      const student2 = students.find(s => s.id === testStudent2Id);
      
      expect(student1).toBeDefined();
      expect(student2).toBeDefined();
      
      // Both should have study_status field
      expect(student1).toHaveProperty('study_status');
      expect(student2).toHaveProperty('study_status');
    });
    
    it('should show "not_studying" for students not in any group', () => {
      const students = getStudents(false);
      const student1 = students.find(s => s.id === testStudent1Id);
      
      // Before adding to group, should be not_studying
      expect(student1!.study_status).toBe('not_studying');
    });
    
    it('should show "studying" after adding to group', () => {
      // Add student 1 to group
      addStudentToGroup(testStudent1Id, testGroupId);
      
      const students = getStudents(false);
      const student1 = students.find(s => s.id === testStudent1Id);
      
      expect(student1!.study_status).toBe('studying');
      
      // Remove from group
      removeStudentFromGroupByIDs(testStudent1Id, testGroupId);
    });
  });
  
  describe('getStudentsWithGroupCount - study_status', () => {
    it('should include both groups_count and study_status', () => {
      const students = getStudentsWithGroupCount(false);
      
      const student1 = students.find(s => s.id === testStudent1Id);
      
      expect(student1).toHaveProperty('groups_count');
      expect(student1).toHaveProperty('study_status');
    });
    
    it('should compute correct study_status based on groups_count', () => {
      // Neither student is in any group
      let students = getStudentsWithGroupCount(false);
      let student1 = students.find(s => s.id === testStudent1Id);
      let student2 = students.find(s => s.id === testStudent2Id);
      
      expect(student1!.groups_count).toBe(0);
      expect(student1!.study_status).toBe('not_studying');
      expect(student2!.groups_count).toBe(0);
      expect(student2!.study_status).toBe('not_studying');
      
      // Add student 1 to group
      addStudentToGroup(testStudent1Id, testGroupId);
      
      students = getStudentsWithGroupCount(false);
      student1 = students.find(s => s.id === testStudent1Id);
      student2 = students.find(s => s.id === testStudent2Id);
      
      expect(student1!.groups_count).toBe(1);
      expect(student1!.study_status).toBe('studying');
      expect(student2!.groups_count).toBe(0);
      expect(student2!.study_status).toBe('not_studying');
      
      // Remove from group
      removeStudentFromGroupByIDs(testStudent1Id, testGroupId);
    });
  });
  
  describe('getStudentById - study_status', () => {
    it('should return student with study_status', () => {
      const student = getStudentById(testStudent1Id);
      
      expect(student).toBeDefined();
      expect(student).toHaveProperty('study_status');
      expect(student!.study_status).toBeDefined();
    });
    
    it('should update study_status when adding to group', () => {
      // Verify initial status
      let student = getStudentById(testStudent2Id);
      expect(student!.study_status).toBe('not_studying');
      
      // Add to group
      addStudentToGroup(testStudent2Id, testGroupId);
      
      // Verify updated status
      student = getStudentById(testStudent2Id);
      expect(student!.study_status).toBe('studying');
      
      // Clean up
      removeStudentFromGroupByIDs(testStudent2Id, testGroupId);
    });
    
    it('should update study_status when removing from group', () => {
      // Add to group first
      addStudentToGroup(testStudent2Id, testGroupId);
      
      let student = getStudentById(testStudent2Id);
      expect(student!.study_status).toBe('studying');
      
      // Remove from group
      removeStudentFromGroupByIDs(testStudent2Id, testGroupId);
      
      // Verify updated status
      student = getStudentById(testStudent2Id);
      expect(student!.study_status).toBe('not_studying');
    });
  });
  
  describe('Multiple groups scenario', () => {
    it('should remain "studying" when in multiple groups', () => {
      // Add student to first group
      addStudentToGroup(testStudent1Id, testGroupId);
      
      let student = getStudentById(testStudent1Id);
      expect(student!.study_status).toBe('studying');
      
      // Add to second group
      addStudentToGroup(testStudent1Id, testGroup2Id);
      
      student = getStudentById(testStudent1Id);
      expect(student!.study_status).toBe('studying');
      
      // Remove from first group - should still be studying
      removeStudentFromGroupByIDs(testStudent1Id, testGroupId);
      
      student = getStudentById(testStudent1Id);
      expect(student!.study_status).toBe('studying');
      
      // Remove from second group - now not studying
      removeStudentFromGroupByIDs(testStudent1Id, testGroup2Id);
      
      student = getStudentById(testStudent1Id);
      expect(student!.study_status).toBe('not_studying');
    });
  });
  
  describe('Edge cases', () => {
    it('should handle archived student groups correctly', () => {
      // Add student to group
      addStudentToGroup(testStudent1Id, testGroupId);
      
      let student = getStudentById(testStudent1Id);
      expect(student!.study_status).toBe('studying');
      
      // Manually archive the student group (set is_active = 0)
      const db = getDb();
      db.prepare(
        'UPDATE student_groups SET is_active = 0, leave_date = CURRENT_DATE WHERE student_id = ? AND group_id = ?'
      ).run(testStudent1Id, testGroupId);
      
      // Should now be not_studying
      student = getStudentById(testStudent1Id);
      expect(student!.study_status).toBe('not_studying');
      
      // Reactivate
      db.prepare(
        'UPDATE student_groups SET is_active = 1, leave_date = NULL WHERE student_id = ? AND group_id = ?'
      ).run(testStudent1Id, testGroupId);
      
      student = getStudentById(testStudent1Id);
      expect(student!.study_status).toBe('studying');
      
      // Clean up properly
      removeStudentFromGroupByIDs(testStudent1Id, testGroupId);
    });
  });
});
