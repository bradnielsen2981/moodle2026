<?php
define('CLI_SCRIPT', true);
require('config.php');
$c = $DB->get_records('course');
foreach ($c as $course) {
    if ($course->id == 1) continue;
    $PAGE->set_course($course);
    $PAGE->set_url(new moodle_url('/course/view.php', ['id' => $course->id]));
    $PAGE->set_pagelayout('course');
    $PAGE->has_secondary_navigation();

    foreach ($PAGE->secondarynav->children as $child) {
        echo "Key: {$child->key}\n";
    }
    break;
}
