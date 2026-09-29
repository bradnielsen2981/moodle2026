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
 * Theme Boost Union - JS code for the contact icons in the grader report.
 *
 * Replaces the email address column of the grader report with "Send message" and "Send email" icons next to the
 * user's name to save horizontal space. The email address column is shown by core if email is configured as
 * a user identity field and the viewer is allowed to see it, so the email icon is only added in this case.
 * The email address cells stay in the DOM (hidden with CSS, see the "Grader report" section in
 * scss/boost_union/post.scss) as the grader report's collapse columns JS relies on them.
 *
 * @module     theme_boost_union/gradercontacts
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {createConversationWithUser} from 'core_message/message_drawer_helper';

const SELECTORS = {
    TABLE: '.gradeparent #user-grades',
    TEMPLATE: '[data-region="theme-boost-union-grader-contacts"]',
    EMAILCELLS: 'th.useremail, td.useremail',
    // The cells in the left part of the report which span the name column and the user identity columns.
    SPANNINGCELLS: 'th.topleft, th.header.range',
    USERROW: 'tr.userrow[data-uid]',
    USERNAME: 'th.user a.username',
    EMAILVALUE: 'td.useremail [data-collapse="content"]',
    MESSAGEDRAWER: '[data-region="message-drawer"]',
    MESSAGEBUTTON: '[data-action="theme-boost-union-grader-message"]',
};

const HIDEEMAILCLASS = 'theme-boost-union-grader-hideemailcol';

let initialized = false;

/**
 * Create an icon link or button from the template.
 *
 * @param {HTMLElement} template The template element holding the icon markup and label.
 * @param {string} name The user's full name, for the accessible label.
 * @returns {HTMLElement}
 */
const createIcon = (template, name) => {
    const icon = template.cloneNode(true);
    icon.classList.remove('d-none');
    icon.setAttribute('aria-label', template.dataset.label + ': ' + name);
    return icon;
};

/**
 * Initialise the contact icons.
 */
export const init = () => {
    const table = document.querySelector(SELECTORS.TABLE);
    const template = document.querySelector(SELECTORS.TEMPLATE);
    if (initialized || !table || !template) {
        return;
    }
    initialized = true;

    const messageTemplate = template.querySelector('[data-type="message"]');
    const emailTemplate = template.querySelector('[data-type="email"]');
    // The message drawer is only on the page if messaging is enabled.
    const canMessage = !!document.querySelector(SELECTORS.MESSAGEDRAWER);

    // Hide the email address column and shrink the cells which span it.
    if (table.querySelector(SELECTORS.EMAILCELLS)) {
        table.querySelectorAll(SELECTORS.SPANNINGCELLS).forEach((cell) => {
            if (cell.colSpan > 1) {
                cell.colSpan -= 1;
            }
        });
        document.body.classList.add(HIDEEMAILCLASS);
    }

    table.querySelectorAll(SELECTORS.USERROW).forEach((row) => {
        const username = row.querySelector(SELECTORS.USERNAME);
        if (!username) {
            return;
        }
        const name = username.textContent.trim();
        const icons = document.createElement('span');
        icons.className = 'theme-boost-union-grader-contacticons';

        if (canMessage) {
            const message = createIcon(messageTemplate, name);
            message.dataset.userid = row.dataset.uid;
            message.id = 'theme-boost-union-grader-message-' + row.dataset.uid;
            icons.appendChild(message);
        }

        const email = row.querySelector(SELECTORS.EMAILVALUE)?.textContent.trim();
        if (email) {
            const emaillink = createIcon(emailTemplate, name);
            emaillink.href = 'mailto:' + email;
            emaillink.title = email;
            icons.appendChild(emaillink);
        }

        if (icons.childElementCount) {
            username.after(icons);
        }
    });

    table.addEventListener('click', (e) => {
        const button = e.target.closest(SELECTORS.MESSAGEBUTTON);
        if (button) {
            e.preventDefault();
            // The message drawer expects "userid", although the helper's docblock says "userId".
            // The "buttonid" is needed as the drawer closes itself on any click outside of it, except on this button.
            createConversationWithUser({userid: parseInt(button.dataset.userid), buttonid: button.id});
        }
    });
};
