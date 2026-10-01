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
 * Theme Boost Union - JS code for the behaviour of the course index drawer.
 *
 * - On activity and resource pages the course index drawer starts closed (see layout/drawers.php). Core scrolls the
 *   course index to the current activity while the drawer is still closed, which has no effect, so this is done again
 *   whenever the drawer is opened.
 * - Following a breadcrumb link closes the course index drawer. When the link loads a new page, a short-lived cookie
 *   tells layout/drawers.php to render that page with the drawer closed (so it does not visibly slide shut). When the
 *   link only jumps to an anchor on the current page, the drawer is closed right away. Neither changes the user's
 *   stored drawer preference.
 *
 * @module     theme_boost_union/courseindexfocus
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import Drawers from 'theme_boost/drawers';

const SELECTORS = {
    DRAWER: '#theme_boost-drawers-courseindex',
    PAGEITEM: '#courseindex .courseindex-item.pageitem',
    BREADCRUMBLINK: '.breadcrumb a[href]',
};

/** Name of the cookie which asks layout/drawers.php to render the next page with the course index drawer closed. */
const CLOSECOOKIE = 'theme_boost_union_closecourseindex';

/**
 * Set or clear the cookie which closes the course index drawer on the next page.
 *
 * @param {boolean} set true to set it, false to clear it
 */
const setCloseCookie = (set) => {
    document.cookie = CLOSECOOKIE + '=' + (set ? '1; max-age=60' : '; max-age=0') + '; path=/; SameSite=Lax';
};

/**
 * Close the course index drawer on the current page without changing the user's drawer preference.
 */
const closeDrawerNow = () => {
    const drawerNode = document.querySelector(SELECTORS.DRAWER);
    const drawer = drawerNode ? Drawers.getDrawerInstanceForNode(drawerNode) : null;
    if (drawer) {
        drawer.closeDrawer({focusOnOpenButton: false, updatePreferences: false});
    }
};

/**
 * Close the course index drawer when a breadcrumb link is followed.
 *
 * @param {MouseEvent} event the click event
 */
const onBreadcrumbClick = (event) => {
    const link = event.target.closest(SELECTORS.BREADCRUMBLINK);
    // Only plain clicks: opening the link in another tab or window should not affect anything.
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
            (link.target && link.target !== '_self')) {
        return;
    }
    const url = new URL(link.href, window.location.href);
    if (url.origin === window.location.origin && url.pathname === window.location.pathname &&
            url.search === window.location.search && url.hash) {
        // Only an anchor on this page: there is no new page to render, so close it here.
        closeDrawerNow();
    } else {
        setCloseCookie(true);
    }
};

/**
 * Scroll the course index so that the current activity is in the middle of the drawer.
 */
const showCurrentItem = () => {
    const item = document.querySelector(SELECTORS.PAGEITEM);
    if (item) {
        item.scrollIntoView({block: 'center'});
    }
};

/**
 * Initialise the module.
 *
 * @param {boolean} activitypage whether this is an activity or resource page
 */
export const init = (activitypage) => {
    // The cookie has done its job once this page is rendered.
    setCloseCookie(false);

    document.addEventListener('click', onBreadcrumbClick);

    if (activitypage) {
        document.addEventListener(Drawers.eventTypes.drawerShown, (event) => {
            if (event.target.closest(SELECTORS.DRAWER)) {
                showCurrentItem();
            }
        });
    }
};
