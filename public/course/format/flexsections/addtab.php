<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

require_once(__DIR__ . '/../../../config.php');
require_once($CFG->dirroot . '/course/lib.php');

$courseid = required_param('courseid', PARAM_INT);
require_sesskey();

$course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
require_login($course);
$context = context_course::instance($course->id);
require_capability('moodle/course:update', $context);

$format = course_get_format($course);
if (get_class($format) !== 'format_flexsections') {
    throw new \moodle_exception('invalidcourseformat');
}

// Create a new top-level section.
$sectionnum = $format->create_new_section(0);

// Get the newly created section.
$section = $format->get_section($sectionnum);

// Set istab = 1.
$format->update_section_format_options(['id' => $section->id, 'istab' => 1]);

redirect(new moodle_url('/course/view.php', ['id' => $course->id, 'section' => $sectionnum]));
