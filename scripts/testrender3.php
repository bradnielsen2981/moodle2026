<?php
define('CLI_SCRIPT', true);
require('config.php');
$c = $DB->get_record('course', ['id' => 2]);
if (!$c) $c = $DB->get_record('course', ['id' => 1]);
$PAGE->set_course($c);
$PAGE->set_url(new moodle_url('/course/view.php', ['id' => $c->id]));
$PAGE->set_heading($c->fullname);
echo $OUTPUT->context_header();
