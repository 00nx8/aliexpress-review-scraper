# Torq
An invoice management app

Garage App — Project Outline
What it is
A simple app for small independent garages — typically one to three people — that connects the three things they currently do separately: looking up how long a job should take, tracking what parts they ordered and what they cost, and generating an invoice at the end. Right now most small garages do these things across a combination of their head, a spreadsheet, and a Word document. This app replaces all of that with one tool on their phone or laptop.

The problem it solves
When a job comes in, a mechanic needs to know the labour time (say, an oil change is 0.8 hours at their hourly rate), what parts they need to order and what those parts cost, and then combine both into a final invoice for the customer. Currently those three steps are disconnected. Parts get ordered from eBay or an online supplier and logged nowhere. Labour times are remembered or looked up manually. The invoice gets assembled from scratch each time, and things get missed. The garage ends up undercharging, or spending twenty minutes on paperwork that should take two.

Who it's for
A one to three person independent garage, owner-operated, doing general servicing and repair work. They're not using any software right now, or they tried something like Shopmonkey or Garage Hive and found it too complicated or too expensive. They order parts from eBay, Autodoc, Euro Car Parts, or a local factors. They work primarily from a phone or a basic laptop. They're in Ireland, the UK, or mainland Europe.

The four core features
1. Job creation from a reg plate
The mechanic types in a customer's registration plate. The app looks it up and returns the make, model, year, and engine size automatically. No manual entry. The mechanic then selects the job type — oil change, brake pads, timing belt, whatever — and the expected labour time fills in automatically from the app's built-in data. They can change the time if the actual job takes longer or shorter. That's the starting point for every job.
2. Parts logging via email forwarding
Every garage gets a unique email address inside the app — something like dave@parts.garagename.com. When the mechanic orders parts from any supplier, they forward the confirmation email to that address. The app reads it, pulls out the item name, the price, and the order date, and creates a draft parts entry asking which job to attach it to. One tap to confirm. Works for eBay, Amazon, Autodoc, Euro Car Parts, or any supplier that sends a confirmation email. No integrations, no API keys, no setup beyond forwarding one email.
3. Automatic invoice generation
When the job is done, the app has everything it needs: the vehicle details, the labour time and rate, and all the parts that were logged. One tap generates a complete itemised invoice — parts listed individually with their costs, labour shown separately, VAT applied correctly for the garage's country, and a total at the bottom. The invoice goes out by email or WhatsApp. The mechanic never has to open Word or do mental arithmetic.
4. Job type library
The app comes with the most common jobs pre-loaded — oil change, front brake pads, rear brake pads, timing belt, clutch, air filter, MOT advisory items — with standard time estimates for common vehicles. The mechanic can edit any of these or add their own. Over time this becomes their personal price book. Their preferred labour rate, their markup on parts, their custom jobs — all saved, all pre-filled next time.

How the data works
Vehicle lookup — Starting with the UK (DVLA, free) and the Netherlands (RDW, free). Both return make, model, year, and engine details from a plate number at no cost. For Ireland and the rest of Europe, a commercial service called Infopro Digital covers seventeen countries and will be added once there is revenue to justify it.
Labour times — Starting with a hand-built dataset of the twenty most common jobs on the fifty most common vehicles in the target markets. This covers roughly seventy percent of what a small garage actually does. A free API called labor-guides.com will be tested first — if it returns reliable data for European vehicles it becomes the primary source. There is also a community project called Open Labor Project, built by a working technician, which is free and covers eighty-seven vehicle makes. The plan is to contact the person who built it and offer a small sponsorship in exchange for a data feed. As the app grows and there are two hundred or more paying customers, the goal is to negotiate a commercial licence with HaynesPro, which is the professional standard in Europe with eleven million labour times across forty-eight thousand vehicle models.
Parts parsing — The email forwarding approach requires no external data service. The app's server receives the forwarded email and extracts the relevant information. An AI-based parser handles the varying formats from different suppliers reliably.

What it is not
It is not an accounting system. It does not do payroll, tax returns, or bookkeeping. It does not manage stock or a physical parts inventory. It does not do fleet management or multi-location. It does not have a customer portal or online booking. All of those things exist in products like Shopmonkey and ServiceTitan, which charge €150 to €400 a month. This app does the three things a small garage actually needs every day, and nothing else, for €25 to €40 a month.

Pricing
€29 per month for a solo garage, €49 for a small team. No annual contract, no setup fee, cancel any time. The positioning is simple: one saved job — one instance where the invoice correctly includes all the parts and the full labour time instead of missing items — pays for six months of the subscription.

Features to implement:
The app should be built in mind with multiple languages in mind. there are 2 supported languages. English dutch romanian polish hungarian + any extra you want to do
Features:
account management
login:
2 fields, 1 for email and a password.
A button to login and 2 links, forgot password and register
register:
4 inputs, email password, repeat passsword, a select for country
options: uk, ireland netherlands
a link to login.
Forgot password:
email, a button to send link
a link to login and register
after the button is clicked the user is shown a confirmation and a button to go to login
The button is sent via server side smtp, the credentials can be found in the .env file

Subscription types:
Business: 59/month
Freelance: 29/month
Trial - free 14 days.
When the user logs in for the first time they are redirected choose subscriptions page.
They see 2 options in cards. the header has freelancer/business with the price, the content is the description below
and the price is displayed in the bottom right of the card.
Under the tiers there is faded text that says skip for now and start a 14 day free trial.
A 14 day free trial is started, the user is redirected to the app
freelancer and business. a small text to describe the tier is shown:
freelance:
Everything the app has to offer.
Smart receipt management invoices, parts, 
cars and labor hours.
Business:
Everything the app has to offer,
with the ability to share your subscription
to your employees.
Clicking on one of the tier hides the card body, and moves the price next to the header
additional text is displayed about the selected tier. the text expands from the card.
Freelance:
Parts management
Simply forward the confirmation email or take a picture of the invoice and well take care of the rest. No more typing in part numbers and prices.
Labor hours
Search for any job and find how long it will take within seconds.
Invoice management
Select the jobs for the cars, add your used parts and your invoice or payment link is ready to send to the customer. 
Torque specs, Fluid specs, DTC codes
We have an extensive list with over 10,000 cars and their specifications.
business:
the same as above and:
Manage your team
Add employees to your team so they can log hours, orders, and more.
A continue button is displayed when the user has selected a subscription tier.
clicking continue takes you to the payment screen
payment screen:
Stripe keys can be found in the .env file.
The user creates a subscription and can move on to the app.
app index:
layout:
The main layout should include the header at top displaying the company name with a wrench icon next to it on the top right, and a back button where applicable
On the bottom there are links to parts, fluids, torque specs, dtcs and settings.
Above this, there are filter options for the jobs. All , invoived, ongoing and completed
index:
under the header there is a button color primary with text start job
clicking it takes you to an empty template for a visit.
Under there, is a list of active job cards the user has.
job card:
top left detailing the car, <make> <model> <engine_size>
under the car info is the license plate
top right is the start date
bottom left is the jobs added to the visit, max 3. any more it gets abbriviated with +x
bottom right is the current price of the job, labour hours + parts cost + charges
job template page:
layout:
the back button takes you to the app index.
The page has multiple cards on it detailing each type attached to the job
jobs: description + labor hours
parts: name, part number under the name, price
charges: misc created by user.
    Can be quantify able like break disc cleaner x2
    or general like tool degredation 
summary:
    all of these detailed and added together

The first row has 2 cards, 1 with the customer details and 1 with the car details

If there is custoner / car details missing they show up as primary buttons with a circle + icon and add car/ add customer
Clicking it enters the user into a flow to add attributes based on which they add first.
Car first:
By country:
NL:
The NL api for car details is very rich, the response can be stored in the db straight away with the car value assigned.
If the license plate exists from a previous visit, show the number of visits and load car data without making an api call
if the car doesnt exist, request from api
UK/Ireland:
The dvla api returns limited information.
if the license plate is register from a previous visit return saved car details
if it doesnt, query dvla.
Use the returned response to query saved car templates and display that to the user.
The query should be done based on make, year and engine size
since engine size is given in cc by the api, use a range of +/-.1L to compare against templates
Show the user the templates that match the criteria and based on their choice,
Populate the db based on the car template and the api response, then link the car to the visit and licenseplate
If the licenseplate is found, prompt the user
if they want to auto fill customer details based on previous visits.
Show a list of customer linked to the visit, and a dont link button
Clicking any customers in the list links the customer to the visit.
Clicking not now takes the user to the add customer page
If there is a customer in the session:
add the car to the visit and take them back to the job page.
add customer with car in session:
There are 3 inputs, name, email phone.
When typing a dropdown menu with previous users is shown.
Each suggestion details the customers name and car type as <make> <model> <engine_size>
Clicking any of those adds the user to the session
add customer Without car:
Same flow as above.
If there is no car attached to the job, a list of cars is shown to the user in a popup
clicking any links the car to the visit.
A button is shown to not auto fill, clicking that takes them to the add car page. 
parts/jobs/charges cards:
each card has an add button next to the title
In the card, the title and cost is displayed in a table like fashion. No dividers
A total is shown at the bottom
add Jobs:
clicking the add button in jobs opens a popup which details all the available jobs for the current car attached to the visit.
Adding a job links that job to the visit. It should be shown in the jobs section.
add parts:
read further
chargers:
add button opens the same style popup as for the jobs but details the created charges in the database.
Adding one links it to the viist.
Summary:
shows the parts total + markup %
labor hours with h @ x/h
charges 
and a total at the bottom
There is a mark as complete button at the bottom of the page.
clicking mark as complete changes the status of the job to completed, the button is replaced with generate invoice.
Clicking generate invoice shows an invoice with the job details and enters the invoice into the db.
There should be a button to print / create payment link using tikkie.
as well as a button to mark paid.
Add parts:
takes the user to the add parts page/
there are 3 cards detailing how parts can be added with a title, icon, short description.
manual:
When clicked the user is taken to a simple form with a name ,part no. brand and cost. A checkbox for add to current job is present. If checked, at continue the part is added to the current job. checked by default.
if not checked, the part is added to the db.
When typing, the user should be given suggestions for parts that already exist in the db. Clicking auto fills and adds to the current job.
email:
the user forwards the confirmation email for the ordered parts to the email in the .env file.
It is parsed, and for each part, the name,  number, price and brand are extracted.
When the user enters the app again, he is shown a popup of the parts parsed from the email
There is a button to edit the part taking them to the same form as the add part, but with the details prefilled
Clicking continue on this form, will take them back to the popup with the edited part having new details
Each part is selectable. there should be an option to select all
having selected any parts, the user is given the option to link the parts to existing visits.
Linked parts from this list will dissapear leaving unlinked parts only.
When all parts have been linked the popup closes.
Picture:
The user is shown a popup to upload a picture of an invoice. 
The user can upload multiple photos at a time. The photos are displayed in a carousel. The user is given the option to delete the currently displayed photo.
The invoice is parsed for name, part no brand and price.
The same flow as email begins when the parts have been parsed.
When the visit was marked as paid for, the buttons to edit the visit disapear
Labor times/Fluids/Torque specs/DTCs:
A list of ~200 car templates is shown.
there is a search bar at the top which queries from all car templates in the db.
When clicking on a car template, a list of either Labor times/Fluids/Torque specs/DTCs is show.
These are also searchable. The same display rules apply as the car templates
All of these should be sorted by category.
settings:
General information:
customer name, email, password reset link
pricing:
set the hourly rate used to generate invoice
set the parts markup by percentage
VAT rate, also percentage.

There should be another table to add charges,
for a charge you can select if they are quantifyable e.g. break disc clearner x1 at 4 euros / bottle
or if they are non quantify able, for example tool degredation at 15 euros
