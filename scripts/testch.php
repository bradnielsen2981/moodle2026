<?php
define('CLI_SCRIPT', true);
require('config.php');
$c = clone $PAGE;
$c->set_course($DB->get_record('course', ['id' => 1]));
echo $OUTPUT->context_header();
