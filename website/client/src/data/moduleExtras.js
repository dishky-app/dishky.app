/**
 * Extra copy for every module's dedicated page: who it is for and common questions.
 * uses: [who, scenario]   faq: [question, answer]
 */
export const moduleExtras = {
  promotions: {
    uses: [["New cafés", "Open with a feature on Dishky's channels instead of waiting for footfall."], ["Seasonal menus", "Launch a festive menu with content made together with our team."], ["Quiet weekdays", "Push a weekday offer to guests who already order through Dishky."]],
    faq: [["Do I need to make the content myself?", "No. We create posts and reels with you, using your dishes, your room and your story."], ["How do guests reach my menu?", "Every post links straight to your Dishky menu, so a viewer can order in a tap."], ["Can I choose what gets promoted?", "Yes. You pick the offers and moments, and we plan the rest together."]],
  },
  events: {
    uses: [["Chef's tables", "Sell a small, special evening with bookings and pre-orders in one place."], ["Pop-ups", "Run a one-off night with QR ordering at every table."], ["Festival nights", "Promote a themed menu and recap it afterwards."]],
    faq: [["Who promotes the event?", "Dishky promotes it on its own platform, from announcement to recap."], ["Can guests book ahead?", "Yes. Reservations, pre-bookings, celebrations and catering are built in."], ["How is service run on the night?", "Guests scan and order, and your team works from the admin panel as usual."]],
  },
  kitchen: {
    uses: [["Busy dinner rush", "See every ticket in New, Cooking and Ready at a glance."], ["Multiple stations", "Keep each cook focused on their own tickets."], ["New kitchen staff", "Timers make pace obvious without anyone shouting."]],
    faq: [["Do I need special hardware?", "No. Any screen with a browser can show the board, and receipt printing is optional."], ["How do tickets arrive?", "The moment a guest places an order, it appears on the board in real time."], ["What do the timers do?", "They warn you when a ticket has been waiting longer than it should."]],
  },
  orders: {
    uses: [["Dine-in", "Guests scan the table QR, order and pay without waiting for a server."], ["Busy counters", "Orders from every table land in one live list."], ["Reorders", "Search order history and reopen any order."]],
    faq: [["Do guests need to install an app?", "No. They scan the QR code and order in the browser."], ["How do guests know their food is coming?", "They see live status updates on their own phone."], ["Can I print bills and kitchen slips?", "Yes. Receipt printing works with your own printers."]],
  },
  staff: {
    uses: [["Owners", "See attendance, pay status and the work plan from one screen."], ["Managers", "Chat with the team and share training without separate tools."], ["New hires", "Follow a clear training path from day one."]],
    faq: [["Does it replace my payroll software?", "It tracks attendance and salary status so the monthly view is always clear."], ["Can staff message each other?", "Yes. Staff chat is part of the module."], ["What is the owner work plan?", "A running list of what needs your attention across the restaurant."]],
  },
  inventory: {
    uses: [["Kitchens", "Know what is on the shelf before the dinner service starts."], ["Owners", "Get a low-stock alert before an item runs out."], ["Chefs", "Link recipes to dishes so usage is tracked as you sell."]],
    faq: [["How do low-stock alerts work?", "Set a minimum for an ingredient and Dishky flags it when stock falls below."], ["What are recipe-linked dishes?", "Dishes that remember their ingredients, so selling a dish updates stock."], ["Can I track many ingredients?", "Yes. Ingredients and stock levels live in one searchable list."]],
  },
  loyalty: {
    uses: [["Regulars", "Reward repeat visits with tiers they can see."], ["Slow evenings", "Send a WhatsApp campaign to bring guests back."], ["New menu items", "Let guests save favourites and reorder in a tap."]],
    faq: [["How do loyalty tiers work?", "Guests move up levels as they visit, and each level can unlock offers."], ["Can I send campaigns?", "Yes, through WhatsApp campaigns to your guest list."], ["Where do guests see their offers?", "In the guest app, next to their favourites."]],
  },
  menu: {
    uses: [["Everyday edits", "Change a price or mark a dish unavailable in seconds."], ["Combos", "Bundle dishes into a combo guests can add in one tap."], ["Seasonal specials", "Add a dish for a week and hide it after."]],
    faq: [["How fast do menu edits go live?", "Right away. Guests see the change on their next scan."], ["Can I hide a dish that is sold out?", "Yes. Availability can be switched off without deleting the dish."], ["Can I organise by category?", "Yes. Categories and dishes are managed together."]],
  },
  service: {
    uses: [["Floor managers", "See every table's status on the floor map."], ["Servers", "Know which sections are theirs for the shift."], ["Closing teams", "Work through mise and cleaning routines with sign-off."]],
    faq: [["Can I assign staff to tables?", "Yes. Assign staff to sections and see it on the floor map."], ["What are service routines?", "Checklists for opening, mise en place, cleaning and closing."], ["Is there a report?", "Yes. Activity and reports show what was done and when."]],
  },
  payments: {
    uses: [["Cashiers", "Take cash, card or UPI and issue a receipt."], ["Owners", "Keep gateways and bank accounts in one place."], ["Groups", "Split a bill without a calculator."]],
    faq: [["Which payment methods work?", "Cash, card and UPI, through your payment gateway."], ["Do guests get receipts?", "Yes. Receipts are generated for every payment."], ["Where are bank accounts set up?", "In Payments, alongside your gateway settings."]],
  },
  analytics: {
    uses: [["Owners", "Check today's sales before you leave the house."], ["Chefs", "See best sellers so the menu earns its space."], ["Managers", "Plan staffing around peak hours."]],
    faq: [["How fresh is the data?", "The dashboard reads live orders, so it updates as you sell."], ["Can I see a week or a month?", "Yes. Switch between Today, Week and Month."], ["What reports are there?", "Sales, best sellers and peak hours, with reports you can open for detail."]],
  },
  branches: {
    uses: [["Growing brands", "Add a second venue without a second login."], ["Area managers", "Compare branches on one screen."], ["Guests", "Each branch has its own link and per-table QR codes."]],
    faq: [["Do branches share a login?", "Yes. One account holds every venue."], ["Does each branch get its own menu link?", "Yes. Each venue has its own link and table QR codes."], ["Can I compare branches?", "Yes. Revenue and orders are shown side by side."]],
  },
  roles: {
    uses: [["Owners", "Give staff exactly the access their role needs."], ["Accountants", "Trace who changed what with audit logs."], ["Growing teams", "Add staff accounts without sharing passwords."]],
    faq: [["Can I limit what a role sees?", "Yes. Role permissions control each area of the panel."], ["Is there an audit trail?", "Yes. Audit logs record important actions."], ["Does access depend on my plan?", "Access is plan-aware, so features match what you subscribe to."]],
  },
  "guest-app": {
    uses: [["Dine-in guests", "Scan, browse a rich menu and order at the table."], ["Regulars", "Reorder favourites and track their order."], ["Event guests", "Book events and tables from the same app."]],
    faq: [["Do guests need an account?", "They can start by scanning, with no app install."], ["Can guests track an order?", "Yes. Live tracking shows each step."], ["Can they pay in the app?", "Yes, through the payment methods you enable."]],
  },
  "back-office": {
    uses: [["Owners", "Keep memos and to-dos next to the data they refer to."], ["Admins", "Store documents where the team can find them."], ["Finance", "Keep bank details in one secure place."]],
    faq: [["What can I store?", "Memos, documents, to-dos and bank accounts."], ["Who can see them?", "Access follows your roles and permissions."], ["Is it separate from orders?", "It sits in the same admin panel but stays out of the way of service."]],
  },
  reservations: {
    uses: [["Weekend dinners", "See every slot and fill the gaps."], ["Large parties", "Match party size to a table that fits."], ["Front desk", "Move a booking from requested to seated."]],
    faq: [["Can guests book themselves?", "Yes. Bookings come through the guest app and appear in your slot grid."], ["Can I change a booking's status?", "Yes. Update it as requested, confirmed or seated."], ["Where do I see details?", "Open any reservation to see its full details."]],
  },
  celebrations: {
    uses: [["Birthdays", "Take a request with guest count and add-ons."], ["Anniversaries", "Prepare the table and a special dish ahead."], ["Private groups", "See every request in one list."]],
    faq: [["What do guests send?", "Occasion type, add-ons, guest count and any notes."], ["Can I approve requests?", "Yes. Review each request's details and update its status."], ["Is it tied to reservations?", "It sits beside reservations so the table is held."]],
  },
  catering: {
    uses: [["Office lunches", "Take a headcount and a menu selection."], ["Parties", "Produce an order sheet the kitchen can follow."], ["Pickup runs", "Choose pickup or delivery for each order."]],
    faq: [["Can guests choose a menu?", "Yes. They pick dishes and headcount."], ["What does the kitchen get?", "An order sheet with quantities."], ["Pickup or delivery?", "Either, chosen per order."]],
  },
  prebookings: {
    uses: [["Dinner dates", "Guests choose dishes before they arrive."], ["Groups", "Cut waiting by starting the order ahead."], ["Busy nights", "Spread kitchen load by arrival time."]],
    faq: [["What is a pre-booking?", "A reservation where dishes are ordered ahead."], ["Does the kitchen see it early?", "Yes, with the arrival time."], ["Can status be updated?", "Yes, from the booking details."]],
  },
  attendance: {
    uses: [["Managers", "See who is on shift right now."], ["Staff", "Clock in and out from a phone."], ["Owners", "Review hours worked over time."]],
    faq: [["How do staff clock in?", "With a tap in the staff view."], ["Is history kept?", "Yes. You can browse past attendance."], ["Does it feed salary?", "Days present show up in the salary view."]],
  },
  salary: {
    uses: [["Owners", "See who has been paid this month."], ["Managers", "Check days present before payday."], ["Accounts", "Track pending payments."]],
    faq: [["What does it show?", "Month view, paid or pending, days present and progress."], ["Does it run payroll?", "It tracks pay status. Payments stay with your bank."], ["Where do days present come from?", "From the attendance module."]],
  },
  careers: {
    uses: [["Hiring", "Post roles and track applicants on a board."], ["Onboarding", "Train new hires inside the same system."], ["Growth", "Show staff a path to the next role."]],
    faq: [["Can I train staff here?", "Yes, with training modules and progress."], ["What happens after hiring?", "Hires move straight to the staff list."], ["Can staff see their path?", "Yes, career paths are visible to them."]],
  },
  "kitchen-management": {
    uses: [["Head chefs", "Assign stations and keep prep on track."], ["Sous chefs", "Follow mise en place lists with sign-off."], ["Owners", "Review daily activity and reports."]],
    faq: [["How is it different from the KDS?", "The KDS runs live tickets. Kitchen Management organises people and prep."], ["Can I store recipes?", "Yes. Every dish's method lives in one place."], ["Is grooming tracked?", "Yes, as a daily check."]],
  },
  "service-management": {
    uses: [["Floor managers", "Assign sections for the shift."], ["Servers", "Follow opening and closing routines."], ["Owners", "Review floor reports."]],
    faq: [["Can I assign sections?", "Yes, to each team member."], ["What routines are included?", "Opening, closing and grooming checklists."], ["Are there reports?", "Yes. Activity reports show what was completed."]],
  },
  offers: {
    uses: [["Happy hour", "Switch an offer on and guests see it immediately."], ["Combos", "Create a combo offer from existing dishes."], ["Testing", "Pause an offer without deleting it."]],
    faq: [["Can I preview an offer?", "Yes, with a guest preview."], ["Can I pause one?", "Yes. Offers can be active or paused."], ["Do offers show in the guest app?", "Active offers appear there right away."]],
  },
  guests: {
    uses: [["Hosts", "Know a regular's favourites before they sit."], ["Owners", "See membership levels across your guest list."], ["Marketing", "Pick the right guests for a campaign."]],
    faq: [["What is in a guest profile?", "Favourites, visit history and membership level."], ["Can I see member details?", "Yes, from each profile."], ["Does it connect to loyalty?", "Yes. Membership levels come from loyalty."]],
  },
  "order-tracking": {
    uses: [["Guests", "See their order move without asking."], ["Servers", "Spend less time answering where is my food."], ["Kitchens", "Update status as part of the usual flow."]],
    faq: [["Where do guests see progress?", "On their own phone, with a progress bar."], ["Who updates the status?", "It follows the kitchen, so there is nothing extra to do."], ["Do guests need to refresh?", "No. It updates live."]],
  },
};
export default moduleExtras;
