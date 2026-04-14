const { convertToModelMessages } = require('ai');
try {
  const sanitizedMessages = [
    {
      role: 'user',
      content: 'чи є проблемні учні?',
      parts: [{ type: 'text', text: 'чи є проблемні учні?' }]
    }
  ];
  console.log(convertToModelMessages(sanitizedMessages));
} catch (error) {
  console.error(error);
}
