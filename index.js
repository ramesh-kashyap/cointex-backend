const { exec } = require('child_process');

// Step 1: Create a new orphan branch to reset history
exec('git checkout --orphan latest_branch', (err, stdout, stderr) => {
  if (err) {
    console.error(`Error creating orphan branch: ${stderr}`);
    return;
  }
  console.log(`Orphan branch created: ${stdout}`);

  // Step 2: Add all files to the staging area
  exec('git add -A', (err, stdout, stderr) => {
    if (err) {
      console.error(`Error adding files: ${stderr}`);
      return;
    }
    console.log(`Files added: ${stdout}`);

    // Step 3: Commit the changes as the first commit
    exec('git commit -m "Initial commit with current state"', (err, stdout, stderr) => {
      if (err) {
        console.error(`Error committing changes: ${stderr}`);
        return;
      }
      console.log(`Changes committed: ${stdout}`);

      // Step 4: Delete the old branch
      exec('git branch -D master', (err, stdout, stderr) => {
        if (err) {
          console.error(`Error deleting old branch: ${stderr}`);
          return;
        }
        console.log(`Old branch deleted: ${stdout}`);

        // Step 5: Rename the current branch to master (or your desired branch name)
        exec('git branch -m master', (err, stdout, stderr) => {
          if (err) {
            console.error(`Error renaming branch: ${stderr}`);
            return;
          }
          console.log(`Branch renamed: ${stdout}`);

          // Step 6: Force-push to remote repository
          exec('git push origin master --force', (err, stdout, stderr) => {
            if (err) {
              console.error(`Error pushing changes: ${stderr}`);
              return;
            }
            console.log(`History reset and pushed to remote: ${stdout}`);
          });
        });
      });
    });
  });
});
