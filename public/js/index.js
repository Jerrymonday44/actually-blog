  document.addEventListener("DOMContentLoaded", () => {
    const loadMoreButton = document.querySelector(".load-more");
    const blogsContainer = document.querySelector(".second-main-container");

    let offset = <%= offset %>;
    const limit = <%= limit %>;

    loadMoreButton.addEventListener("click", async (e) => {
      e.preventDefault(); // Prevent default link behavior

      loadMoreButton.textContent = "Loading..."; // Indicate loading

      try {
        const response = await fetch(`/load-more-blogs?offset=${offset + limit}&limit=${limit}`);
        const data = await response.json();

        if (data.blogs && data.blogs.length) {
          data.blogs.forEach((blog) => {
            const blogElement = document.createElement("div");

            // Generate HTML for each blog dynamically
            blogElement.innerHTML = `
              ${
                blog.image && blog.image.length
                  ? `<img class="blog-image" src="${blog.image[0].path}" alt="blog-image" loading="lazy" />`
                  : `<div id="media" class="placeholder"><p>No image available</p></div>`
              }
              <h3 id="blog-topic">${blog.topic}</h3>
              <h4>${blog.summary}</h4>
              <strong id="author">Author: ${blog.author}</strong>
              <p class="blog-date"><small>Published on: ${blog.date}</small></p>
              <div id="news-link">
                <a class="read-more" href="/blogs/${blog.id}">Read More</a>
              </div>
            `;

            blogsContainer.appendChild(blogElement); // Append new blogs
          });

          offset += limit; // Update offset for the next request
        } else {
          loadMoreButton.style.display = "none"; // Hide button if no more blogs
        }
      } catch (error) {
        console.error("Error loading more blogs:", error);
        alert("Failed to load more blogs. Please try again later.");
      } finally {
        loadMoreButton.textContent = "Load More"; // Reset button text
      }
    });
  });

document.addEventListener('DOMContentLoaded', () => {
  const hamburgerMenu = document.querySelector('.hamburger-menu');
  const dropdownMenu = document.querySelector('.nav-links');

  if (!hamburgerMenu || !dropdownMenu) {
    console.warn("Dropdown elements not found on this page.");
    return;
  }

  hamburgerMenu.addEventListener('click', (event) => {
    event.stopPropagation();
    dropdownMenu.classList.toggle('show');
  });

  document.addEventListener('click', (event) => {
    if (!dropdownMenu.contains(event.target) && !hamburgerMenu.contains(event.target)) {
      dropdownMenu.classList.remove('show');
    }
  });
});