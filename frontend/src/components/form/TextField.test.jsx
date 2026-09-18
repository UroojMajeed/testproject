import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextField } from './TextField.jsx';

describe('TextField', () => {
  it('associates the label with the input', () => {
    render(<TextField label="Work email" />);
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
  });

  it('marks required fields for assistive tech, not just visually', () => {
    render(<TextField label="Email" required />);
    const input = screen.getByLabelText(/email/i);
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('(required)')).toBeInTheDocument();
  });

  it('links the error to the input and announces invalidity', () => {
    render(<TextField label="Email" error="Enter a valid email address" />);
    const input = screen.getByLabelText(/email/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy)).toHaveTextContent('Enter a valid email address');
  });

  it('links the hint when there is no error', () => {
    render(<TextField label="Email" hint="We never share this" />);
    const input = screen.getByLabelText(/email/i);
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(document.getElementById(input.getAttribute('aria-describedby')))
      .toHaveTextContent('We never share this');
  });

  it('gives each instance its own id', () => {
    render(<><TextField label="First" /><TextField label="Second" /></>);
    const a = screen.getByLabelText('First');
    const b = screen.getByLabelText('Second');
    expect(a.id).not.toBe(b.id);
  });
});
