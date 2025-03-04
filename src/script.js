import { Client } from "@gradio/client";

document.addEventListener('DOMContentLoaded', function() {
    const uploadBoxes = document.querySelectorAll('.upload-box');
    const fileInputs = document.querySelectorAll('.file-input');
    const runButton = document.getElementById('runButton');
    const seedInput = document.getElementById('seed');
    const randomSeedCheckbox = document.getElementById('randomSeed');

    // Store uploaded files
    let uploadedFiles = {
        person: null,
        garment: null
    };

    // Initialize Gradio client
    let gradioClient = null;
    async function initializeClient() {
        try {
            console.log('Initializing Gradio client...');
            gradioClient = await Client.connect("levihsu/OOTDiffusion", {
                hf_token: ""  // Your Hugging Face token
            });
            console.log('Gradio client initialized successfully');
        } catch (error) {
            console.error("Error initializing Gradio client:", error);
        }
    }
    initializeClient();

    // Handle drag and drop
    uploadBoxes.forEach((box, index) => {
        box.addEventListener('dragover', (e) => {
            e.preventDefault();
            box.style.borderColor = '#45a049';
        });

        box.addEventListener('dragleave', () => {
            box.style.borderColor = '#ccc';
        });

        box.addEventListener('drop', (e) => {
            e.preventDefault();
            box.style.borderColor = '#ccc';
            const file = e.dataTransfer.files[0];
            handleFile(file, index);
        });

        box.addEventListener('click', () => {
            fileInputs[index].click();
        });
    });

    // Handle file input change
    fileInputs.forEach((input, index) => {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            handleFile(file, index);
        });
    });

    // Handle file upload and preview
    function handleFile(file, index) {
        console.log('Handling file:', file.name, 'size:', file.size, 'type:', file.type);
        
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            const previewId = index === 0 ? 'personPreview' : 'garmentPreview';
            const preview = document.getElementById(previewId);

            // Store the file
            if (index === 0) {
                uploadedFiles.person = file;
            } else {
                uploadedFiles.garment = file;
            }

            // Create preview
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };

            reader.onerror = () => {
                preview.innerHTML = '<p style="color: red;">Error loading image</p>';
            };

            reader.readAsDataURL(file);
        }
    }

    // Handle random seed checkbox
    randomSeedCheckbox.addEventListener('change', () => {
        seedInput.disabled = randomSeedCheckbox.checked;
        if (randomSeedCheckbox.checked) {
            seedInput.value = Math.floor(Math.random() * 1000000);
        }
    });

    // Handle run button click
    runButton.addEventListener('click', async () => {
        if (!uploadedFiles.person || !uploadedFiles.garment) {
            alert('Please upload both person and garment images first.');
            return;
        }

        if (!gradioClient) {
            alert('API client is not initialized. Please refresh the page.');
            return;
        }

        const resultBox = document.getElementById('resultBox');
        resultBox.innerHTML = `
            <div class="loading"></div>
            <p>Processing... Please wait.</p>
        `;
        
        try {
            // Convert File objects to Blob URLs
            const personBlob = new Blob([uploadedFiles.person], { type: uploadedFiles.person.type });
            const garmentBlob = new Blob([uploadedFiles.garment], { type: uploadedFiles.garment.type });

            const result = await gradioClient.predict("/process_hd", [
                personBlob,
                garmentBlob,
                1,
                20,
                2,
                randomSeedCheckbox.checked ? -1 : parseInt(seedInput.value)
            ]);

            // Check for quota error
            if (result.type === "status" && !result.success) {
                if (result.message && result.message.includes("exceeded your GPU quota")) {
                    // Extract wait time from message
                    const waitTime = result.message.match(/retry in ([\d:]+)/)[1];
                    throw new Error(`GPU quota exceeded. Please wait ${waitTime} before trying again, or sign up on Hugging Face for more quota.`);
                }
                throw new Error(result.message || 'API request failed');
            }

            console.log('API Response:', result);

            if (!result || !result.data) {
                throw new Error('No response from server');
            }

            // Log the data structure for debugging
            console.log('Data structure:', JSON.stringify(result.data, null, 2));

            // Extract image from response
            if (result.data && result.data[0] && result.data[0][0]) {
                const imageData = result.data[0][0];
                console.log('Image data:', imageData);

                if (imageData.image && imageData.image.url) {
                    // Use the URL from the API response
                    resultBox.innerHTML = `
                        <img src="${imageData.image.url}" alt="Try-on Result" style="max-width: 100%;">
                    `;
                } else {
                    console.log('Unexpected image data format:', imageData);
                    resultBox.innerHTML = '<p>Error: No image URL in response</p>';
                }
            } else {
                resultBox.innerHTML = '<p>Error: No output image received</p>';
                console.error('Unexpected response structure:', result);
            }

        } catch (error) {
            console.error('Error:', error);
            resultBox.innerHTML = `
                <div class="error-message">
                    <p style="color: red;">${error.message}</p>
                    ${error.message.includes('GPU quota') ? 
                        '<p>Consider <a href="https://huggingface.co/join" target="_blank">signing up for a Hugging Face account</a> to get more quota.</p>' 
                        : ''}
                </div>
            `;
        }
    });

    // Add loading indicator to the page
    const addLoadingIndicator = () => {
        const style = document.createElement('style');
        style.textContent = `
            .loading {
                display: inline-block;
                width: 50px;
                height: 50px;
                border: 3px solid #f3f3f3;
                border-radius: 50%;
                border-top: 3px solid #3498db;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    };

    addLoadingIndicator();
}); 