// Kiểm tra nếu thanh đã tồn tại
if (!document.getElementById('myOptionBar')) {

    // Tạo thanh option
    const bar = document.createElement('div');
    bar.id = 'myOptionBar';

    // Danh sách option mẫu
    const options = [
        { name: 'Option 1', action: () => alert('Bạn chọn Option 1') },
        { name: 'Option 2', action: () => alert('Bạn chọn Option 2') },
        { name: 'Option 3', action: () => alert('Bạn chọn Option 3') }
    ];

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.textContent = opt.name;
        btn.onclick = opt.action;
        bar.appendChild(btn);
    });

    // Nút đóng thanh
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '✖';
    closeBtn.className = 'closeBtn';
    closeBtn.onclick = () => bar.remove();
    bar.appendChild(closeBtn);

    // Thêm thanh vào body
    document.body.appendChild(bar);
}
