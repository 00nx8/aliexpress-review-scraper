TODOS:

Add a way to delete a visit
 - This should include all the information associated with it. Delete link between licenseplate, invoices and parsed documents
 - Add a way to delete account. This should include all associatedd information.

Trial:
  - This is a general login thing, setting the login is buggy with the redirect middleware

NL:
From testing:
 - On successful login, user is not redirected to /
Info screens:
 - When searching break shows break fluid but break space fluid does not.
  - This applies to all search fields.
  - When entering a submenu in the search, the query for the car does not get emptied
  - no search results for sokda, Fabia provides valid results.
  Information about DTC codes is not displayed when going to its page.
  - Search for a drc code should display some to start with.
General:
 - There should be a way to edit customers

Jobs:
  - When linking a customer to a job, the job becomes a copy in terms of parts / labor of the job the original customer was linked from.
    - maybe the state just wasnt cleared properly?
  - when a customer clicks start job, the visit should not be persistant until details are added to it.
  - capitalize search bar for licenseplate
  - When opening add labor, the suggested results are empty
  - When requesting, Too much data is returned.
  - Adding a part with the same name, brand, fails.
    - Have a graceful message that they should use the existing part instead and edit the price. 
    - When reusing parts, the backend tries to insert it, giving an error about a unique constraint
  - Linking a customer to a job still prompts the link previous customer on car lookup
  - Customer being added with a licenseplate linked does not prompt the link car from previous visit.
  - Charges are not serializable
    - There needs to be a toggle to set if its quantifiable or not

  - Payment link after generating invoice should be either copied or shared
  - clicking back, takes the user in a loop between 0 -> -1 -> 0 -> -1


UK:
  - Endpoint for car lookup is returning 1.0L for a 1.4L car

Add a section at the bottom of settings stating we dont
do anything with the provided information and we wont send letters