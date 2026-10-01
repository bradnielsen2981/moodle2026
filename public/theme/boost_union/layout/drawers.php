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

/**
 * Theme Boost Union - Drawers page layout.
 *
 * This layoutfile is based on theme/boost/layout/drawers.php
 *
 * Modifications compared to this layout file:
 * * Include activity navigation
 * * Include course related hints
 * * Include back to top button
 * * Include scroll spy
 * * Include footnote
 * * Include static pages
 * * Include accessibility pages
 * * Include Jvascript disabled hint
 * * Include advertisement tiles
 * * Include slider
 * * Include info banners
 * * Include additional block regions
 * * Handle admin setting for right-hand block drawer of site home
 * * Include smart menus
 * * Include course index modification
 *
 * @package   theme_boost_union
 * @copyright 2022 Luca Bösch, BFH Bern University of Applied Sciences luca.boesch@bfh.ch
 * @copyright based on code from theme_boost by Bas Brands
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/behat/lib.php');
require_once($CFG->dirroot . '/course/lib.php');

// Require own locallib.php.
require_once($CFG->dirroot . '/theme/boost_union/locallib.php');

// Add activity navigation if the feature is enabled.
$activitynavigation = get_config('theme_boost_union', 'activitynavigation');
if ($activitynavigation == THEME_BOOST_UNION_SETTING_SELECT_YES) {
    $PAGE->theme->usescourseindex = false;
}

// Add block button in editing mode.
$addblockbutton = $OUTPUT->addblockbutton();

if (isloggedin()) {
    $courseindexopen = (get_user_preferences('drawer-open-index', true) == true);

    if (isguestuser()) {
        $sitehomerighthandblockdrawerserverconfig = get_config('theme_boost_union', 'showsitehomerighthandblockdraweronguestlogin');
    } else {
        $sitehomerighthandblockdrawerserverconfig = get_config('theme_boost_union', 'showsitehomerighthandblockdraweronfirstlogin');
    }

    $isadminsettingyes = ($sitehomerighthandblockdrawerserverconfig == THEME_BOOST_UNION_SETTING_SELECT_YES);
    $blockdraweropen = (get_user_preferences('drawer-open-block', $isadminsettingyes)) == true;
} else {
    $courseindexopen = false;
    $blockdraweropen = false;

    if (get_config('theme_boost_union', 'showsitehomerighthandblockdraweronvisit') == THEME_BOOST_UNION_SETTING_SELECT_YES) {
        $blockdraweropen = true;
    }
}

if (defined('BEHAT_SITE_RUNNING') && get_user_preferences('behat_keep_drawer_closed') != 1) {
    try {
        if (
            get_config('theme_boost_union', 'showsitehomerighthandblockdraweronvisit') === false &&
            get_config('theme_boost_union', 'showsitehomerighthandblockdraweronguestlogin') === false &&
            get_config('theme_boost_union', 'showsitehomerighthandblockdraweronfirstlogin') === false
        ) {
            $blockdraweropen = true;
        }
    } catch (Exception $e) {
        echo $e->getMessage();

        $blockdraweropen = true;
    }
}

$extraclasses = ['uses-drawers'];
if ($courseindexopen) {
    $extraclasses[] = 'drawer-open-index';
}

$blockshtml = $OUTPUT->blocks('side-pre');
$hasblocks = (strpos($blockshtml, 'data-block=') !== false || !empty($addblockbutton));
if (!$hasblocks) {
    $blockdraweropen = false;
}
$courseindex = core_course_drawer();
if (!$courseindex) {
    $courseindexopen = false;
}

// On activity and resource pages, the course index drawer always starts closed, and opening or closing it there is not
// remembered (so it does not change whether it is open on the course page). When it is opened, it shows where the
// user currently is in the course.
// Likewise, after following a breadcrumb link, the course index drawer starts closed, without changing the stored
// preference (the cookie is set and cleared again by theme_boost_union/courseindexfocus).
$courseindexpreference = 'drawer-open-index';
if ($courseindex) {
    $isactivitypage = ($PAGE->context->contextlevel == CONTEXT_MODULE);
    if ($isactivitypage || !empty($_COOKIE['theme_boost_union_closecourseindex'])) {
        $courseindexopen = false;
        $extraclasses = array_values(array_diff($extraclasses, ['drawer-open-index']));
    }
    if ($isactivitypage) {
        $courseindexpreference = '';
    }
    $PAGE->requires->js_call_amd('theme_boost_union/courseindexfocus', 'init', [$isactivitypage]);
}

$forceblockdraweropen = $OUTPUT->firstview_fakeblocks();

// Only apply secondary navigation modifications in Course and Module contexts.
$is_course_context = in_array($PAGE->context->contextlevel, [CONTEXT_COURSE, CONTEXT_MODULE]);

$secondarynavigationicons = $is_course_context && (get_config('theme_boost_union', 'secondarynavigationicons') === THEME_BOOST_UNION_SETTING_SELECT_YES);
if ($secondarynavigationicons && $PAGE->secondarynav) {
    $coursehome = $PAGE->secondarynav->find('coursehome', null);
    if ($coursehome) {
        $coursehome->remove();
    }
}

$secondarynavigation = false;
$overflow = '';
if ($PAGE->has_secondary_navigation()) {
    $tablistnav = $PAGE->has_tablist_secondary_navigation();
    $moremenu = new \core\navigation\output\more_menu($PAGE->secondarynav, 'nav-tabs', true, $tablistnav);
    $secondarynavigation = $moremenu->export_for_template($OUTPUT);
    
    if ($secondarynavigationicons && isset($secondarynavigation['nodecollection']->children)) {
        $custom_nodes = [];
        foreach ($secondarynavigation['nodecollection']->children as $child) {
            $node = new \stdClass();
            $node->key = $child->key;
            $node->text = $child->text;
            $node->text = theme_boost_union_get_secondary_nav_text($node->key, $node->text);
            $node->title = $node->text;
            // Handle URL output safely
            if (isset($child->action) && $child->action instanceof \moodle_url) {
                $node->url = $child->action->out(false);
            } else if (isset($child->action) && is_string($child->action)) {
                $node->url = $child->action;
            } else {
                $node->url = '';
            }
            $node->isactive = $child->isactive;
            $node->haschildren = false;
            
            $node->iconhtml = theme_boost_union_get_secondary_nav_icon($node->key, $node->text);

            $custom_nodes[] = $node;
        }

        $max_icons = 4;
        if (count($custom_nodes) > $max_icons) {
            $visible = array_slice($custom_nodes, 0, $max_icons);
            $hidden = array_slice($custom_nodes, $max_icons);
            
            $morenode = new \stdClass();
            $morenode->key = 'more';
            $morenode->text = get_string('moremenu', 'core');
            $morenode->title = get_string('moremenu', 'core');
            $morenode->iconhtml = theme_boost_union_get_secondary_nav_icon('more', $morenode->text);
            $morenode->haschildren = true;
            $morenode->children = $hidden;
            $morenode->isactive = false;
            foreach ($hidden as $h) {
                if ($h->isactive) {
                    $morenode->isactive = true;
                    break;
                }
            }
            $visible[] = $morenode;
            $custom_nodes = $visible;
        }
        
        $secondarynavigation['custom_nodes'] = $custom_nodes;
    }

    $overflowdata = $PAGE->secondarynav->get_overflow_menu_data();
    if (!is_null($overflowdata)) {
        $selectmenu = new \core\output\select_menu(
            'tertiarynavigation',
            $overflowdata->urls,
            $overflowdata->selected,
        );
        $selectmenu->set_label($overflowdata->label, $overflowdata->labelattributes);
        $overflow = $selectmenu->export_for_template($OUTPUT);
    }
}

// Load the navigation from boost_union primary navigation, the extended version of core primary navigation.
// It includes the smart menus and menu items, for multiple locations.
$primary = new theme_boost_union\output\navigation\primary($PAGE);
$renderer = $PAGE->get_renderer('core');
$primarymenu = $primary->export_for_template($renderer);

// Add special class selectors to improve the Smart menus SCSS selectors.
if (isset($primarymenu['includesmartmenu']) && $primarymenu['includesmartmenu'] == true) {
    $extraclasses[] = 'theme-boost-union-smartmenu';
}

if (!empty($primarymenu['bottombar']) && !empty($primarymenu['bottombar']['drawer']) && !empty($primarymenu['includesmartmenu'])) {
    $extraclasses[] = 'theme-boost-union-bottombar';
}

// Add a class selector if the breadcrumbs should be shown on all pages within a course.
if (
    get_config('theme_boost_union', 'categorybreadcrumbs') == THEME_BOOST_UNION_SETTING_SELECT_YES &&
        in_array($PAGE->context->contextlevel, [CONTEXT_COURSE, CONTEXT_MODULE])
) {
    $extraclasses[] = 'theme-boost-union-coursebreadcrumbs';
}

// Include the extra classes for the course index modification.
require_once(__DIR__ . '/includes/courseindex.php');

// Include the extra classes for the section appearance modification.
require_once(__DIR__ . '/includes/sectionappearance.php');

$buildregionmainsettings = !$PAGE->include_region_main_settings_in_header_actions() && !$PAGE->has_secondary_navigation();
// If the settings menu will be included in the header then don't add it here.
$regionmainsettingsmenu = $buildregionmainsettings ? $OUTPUT->region_main_settings_menu() : false;

$bodyattributes = $OUTPUT->body_attributes($extraclasses); // In the original layout file, this line is place more above,
                                                           // but we amended $extraclasses and had to move it.

$header = $PAGE->activityheader;
$headercontent = $header->export_for_template($renderer);

$coursefullname = $PAGE->course?->fullname ? format_string(
    $PAGE->course->fullname,
    true,
    ['context' => context_course::instance($PAGE->course->id), 'escape' => false],
) : '';
$courseurl = $PAGE->course ? new \core\url('/course/view.php', ['id' => $PAGE->course->id]) : null;

$secondarynavigationposition = $is_course_context ? get_config('theme_boost_union', 'secondarynavigationposition') : THEME_BOOST_UNION_SETTING_SECONDARYNAVIGATIONPOSITION_BELOWHEADER;
$secondarynavigationaboveheader = ($secondarynavigationposition === THEME_BOOST_UNION_SETTING_SECONDARYNAVIGATIONPOSITION_ABOVEHEADER);
$secondarynavigationincourseindex = ($secondarynavigationposition === THEME_BOOST_UNION_SETTING_SECONDARYNAVIGATIONPOSITION_COURSEINDEX);

$templatecontext = [
    'sitename' => format_string($SITE->shortname, true, ['context' => context_course::instance(SITEID), "escape" => false]),
    'coursefullname' => $coursefullname,
    'courseurl' => $courseurl ? $courseurl->out(false) : null,
    'output' => $OUTPUT,
    'sidepreblocks' => $blockshtml,
    'hasblocks' => $hasblocks,
    'bodyattributes' => $bodyattributes,
    'courseindexopen' => $courseindexopen,
    'courseindexpreference' => $courseindexpreference,
    'blockdraweropen' => $blockdraweropen,
    'courseindex' => $courseindex,
    'primarymoremenu' => $primarymenu['moremenu'],
    'secondarymoremenu' => $secondarynavigation ?: false,
    'secondarynavigationicons' => $secondarynavigationicons,
    'secondarynavigationaboveheader' => $secondarynavigationaboveheader,
    'secondarynavigationincourseindex' => $secondarynavigationincourseindex,
    'mobileprimarynav' => $primarymenu['mobileprimarynav'],
    'usermenu' => $primarymenu['user'],
    'langmenu' => $primarymenu['lang'],
    'forceblockdraweropen' => $forceblockdraweropen,
    'regionmainsettingsmenu' => $regionmainsettingsmenu,
    'hasregionmainsettingsmenu' => !empty($regionmainsettingsmenu),
    'overflow' => $overflow,
    'headercontent' => $headercontent,
    'addblockbutton' => $addblockbutton,
];

// Include the template content for the course related hints.
require_once(__DIR__ . '/includes/courserelatedhints.php');

// Include the template content for the block regions.
require_once(__DIR__ . '/includes/blockregions.php');

// Include the content for the back to top button.
require_once(__DIR__ . '/includes/backtotopbutton.php');

// Include the content for the Boost Union footer buttons.
require_once(__DIR__ . '/includes/footerbuttons.php');

// Include the content for the scrollspy.
require_once(__DIR__ . '/includes/scrollspy.php');

// Include the template content for the footnote.
require_once(__DIR__ . '/includes/footnote.php');

// Include the template content for the static pages.
require_once(__DIR__ . '/includes/staticpages.php');

// Include the template content for the accessibility pages.
require_once(__DIR__ . '/includes/accessibilitypages.php');

// Include the template content for the footer button.
require_once(__DIR__ . '/includes/footer.php');

// Include the template content for the JavaScript disabled hint.
require_once(__DIR__ . '/includes/javascriptdisabledhint.php');

// Include the template content for the info banners.
require_once(__DIR__ . '/includes/infobanners.php');

// Include the template content for the navbar.
require_once(__DIR__ . '/includes/navbar.php');

// Include the template content for the advertisement tiles, but only if we are on the frontpage.
if ($PAGE->pagelayout == 'frontpage') {
    require_once(__DIR__ . '/includes/advertisementtiles.php');
}

// Include the template content for the slider, but only if we are on the frontpage.
if ($PAGE->pagelayout == 'frontpage') {
    require_once(__DIR__ . '/includes/slider.php');
}

// Include the template content for the smart menus.
require_once(__DIR__ . '/includes/smartmenus.php');

// If we are on MWP.
if (\theme_boost_union\local\mwp::extension_present() == true) {
    // Call the BU MWP class method only if the class and method exist.
    if (
        class_exists('\\local_boost_union_mwp\\local\\layouts') &&
            method_exists('\\local_boost_union_mwp\\local\\layouts', 'postprocess_drawers_templatecontext')
    ) {
        // Post-process the templatecontext array.
        $templatecontext = \local_boost_union_mwp\local\layouts::postprocess_drawers_templatecontext($templatecontext);
    }

    // Render drawers.mustache from local_boost_union_mwp.
    echo $OUTPUT->render_from_template('local_boost_union_mwp/drawers', $templatecontext);

    // Otherwise.
} else {
    // Render drawers.mustache from theme_boost (which is overridden in theme_boost_union).
    echo $OUTPUT->render_from_template('theme_boost/drawers', $templatecontext);
}
